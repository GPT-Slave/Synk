export type ParticipantInvitationView =
  "join" | "restoring" | "confirm-identity" | "availability" | "restore-error";

export interface ParticipantInvitationState {
  hasSessionToken: boolean;
  hasParticipantSession: boolean;
  identityConfirmed: boolean;
  sessionStatus: "pending" | "error" | "success";
  unauthorized: boolean;
}

export interface ParticipantStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface StoredParticipantSession {
  displayName: string;
  sessionToken: string;
}

export const PARTICIPANT_STORAGE_EVENT = "synk-participant-storage";
export const REMEMBERED_NAMES_STORAGE_KEY = "synk:participant-names:v1";

const MAX_REMEMBERED_NAMES = 8;
const MAX_MEETING_SESSIONS = 8;

export function participantInvitationView({
  hasSessionToken,
  hasParticipantSession,
  identityConfirmed,
  sessionStatus,
  unauthorized,
}: ParticipantInvitationState): ParticipantInvitationView {
  if (!hasSessionToken || unauthorized) return "join";
  if (hasParticipantSession) {
    return identityConfirmed ? "availability" : "confirm-identity";
  }
  if (sessionStatus === "pending") return "restoring";
  return "restore-error";
}

export function normalizeDisplayName(displayName: string): string {
  return displayName.trim().replace(/\s+/g, " ");
}

export function displayNameIdentity(displayName: string): string {
  return normalizeDisplayName(displayName)
    .normalize("NFKC")
    .toLocaleLowerCase("en-US");
}

export function readRememberedNames(storage: ParticipantStorage): string[] {
  return parseRememberedNames(safeGet(storage, REMEMBERED_NAMES_STORAGE_KEY));
}

export function rememberParticipantName(
  storage: ParticipantStorage,
  displayName: string,
): string[] {
  const normalized = normalizeDisplayName(displayName);
  const names = uniqueNames([
    normalized,
    ...readRememberedNames(storage),
  ]).slice(0, MAX_REMEMBERED_NAMES);
  safeSet(storage, REMEMBERED_NAMES_STORAGE_KEY, JSON.stringify(names));
  return names;
}

export function readMeetingParticipantSessions(
  storage: ParticipantStorage,
  meetingToken: string,
): StoredParticipantSession[] {
  const raw = safeGet(storage, meetingSessionsStorageKey(meetingToken));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const sessions = parsed.flatMap((value) => {
      if (!isRecord(value)) return [];
      const displayName = normalizeDisplayName(
        typeof value.displayName === "string" ? value.displayName : "",
      );
      const sessionToken =
        typeof value.sessionToken === "string" ? value.sessionToken : "";
      if (
        !isValidDisplayName(displayName) ||
        !isValidSessionToken(sessionToken)
      ) {
        return [];
      }
      return [{ displayName, sessionToken }];
    });
    return uniqueSessions(sessions).slice(0, MAX_MEETING_SESSIONS);
  } catch {
    return [];
  }
}

export function rememberParticipantSession(
  storage: ParticipantStorage,
  meetingToken: string,
  session: StoredParticipantSession,
): void {
  const displayName = normalizeDisplayName(session.displayName);
  if (
    !isValidDisplayName(displayName) ||
    !isValidSessionToken(session.sessionToken)
  ) {
    return;
  }
  rememberParticipantName(storage, displayName);
  const sessions = uniqueSessions([
    { displayName, sessionToken: session.sessionToken },
    ...readMeetingParticipantSessions(storage, meetingToken),
  ]).slice(0, MAX_MEETING_SESSIONS);
  safeSet(
    storage,
    meetingSessionsStorageKey(meetingToken),
    JSON.stringify(sessions),
  );
  setActiveParticipantToken(storage, meetingToken, session.sessionToken);
}

export function findMeetingParticipantSession(
  sessions: StoredParticipantSession[],
  displayName: string,
): StoredParticipantSession | undefined {
  const identity = displayNameIdentity(displayName);
  return sessions.find(
    (session) => displayNameIdentity(session.displayName) === identity,
  );
}

export function removeMeetingParticipantSession(
  storage: ParticipantStorage,
  meetingToken: string,
  sessionToken: string,
): void {
  const sessions = readMeetingParticipantSessions(storage, meetingToken).filter(
    (session) => session.sessionToken !== sessionToken,
  );
  safeSet(
    storage,
    meetingSessionsStorageKey(meetingToken),
    JSON.stringify(sessions),
  );
  if (getActiveParticipantToken(storage, meetingToken) === sessionToken) {
    clearActiveParticipantToken(storage, meetingToken);
  }
}

export function getActiveParticipantToken(
  storage: ParticipantStorage,
  meetingToken: string,
): string | undefined {
  return (
    safeGet(storage, activeParticipantStorageKey(meetingToken)) ??
    safeGet(storage, legacyParticipantStorageKey(meetingToken)) ??
    undefined
  );
}

export function setActiveParticipantToken(
  storage: ParticipantStorage,
  meetingToken: string,
  sessionToken: string,
): void {
  if (!isValidSessionToken(sessionToken)) return;
  safeSet(storage, activeParticipantStorageKey(meetingToken), sessionToken);
}

export function clearActiveParticipantToken(
  storage: ParticipantStorage,
  meetingToken: string,
): void {
  safeRemove(storage, activeParticipantStorageKey(meetingToken));
  safeRemove(storage, legacyParticipantStorageKey(meetingToken));
}

export function participantStorageSnapshot(
  storage: ParticipantStorage,
  meetingToken: string,
): string {
  return JSON.stringify({
    activeToken: getActiveParticipantToken(storage, meetingToken) ?? "",
    names: safeGet(storage, REMEMBERED_NAMES_STORAGE_KEY) ?? "",
    sessions: safeGet(storage, meetingSessionsStorageKey(meetingToken)) ?? "",
  });
}

function parseRememberedNames(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return uniqueNames(
      parsed.filter((value): value is string => typeof value === "string"),
    ).slice(0, MAX_REMEMBERED_NAMES);
  } catch {
    return [];
  }
}

function uniqueNames(names: string[]): string[] {
  const identities = new Set<string>();
  return names.flatMap((name) => {
    const normalized = normalizeDisplayName(name);
    if (!isValidDisplayName(normalized)) return [];
    const identity = displayNameIdentity(normalized);
    if (identities.has(identity)) return [];
    identities.add(identity);
    return [normalized];
  });
}

function uniqueSessions(
  sessions: StoredParticipantSession[],
): StoredParticipantSession[] {
  const names = new Set<string>();
  const tokens = new Set<string>();
  return sessions.filter((session) => {
    const identity = displayNameIdentity(session.displayName);
    if (names.has(identity) || tokens.has(session.sessionToken)) return false;
    names.add(identity);
    tokens.add(session.sessionToken);
    return true;
  });
}

function isValidDisplayName(displayName: string): boolean {
  return displayName.length >= 2 && displayName.length <= 30;
}

function isValidSessionToken(sessionToken: string): boolean {
  return /^[A-Za-z0-9_-]{20,200}$/.test(sessionToken);
}

function activeParticipantStorageKey(meetingToken: string): string {
  return `synk:participant:${meetingToken}`;
}

function legacyParticipantStorageKey(meetingToken: string): string {
  return `calendra:participant:${meetingToken}`;
}

function meetingSessionsStorageKey(meetingToken: string): string {
  return `synk:participant-sessions:${meetingToken}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeGet(storage: ParticipantStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(
  storage: ParticipantStorage,
  key: string,
  value: string,
): void {
  try {
    storage.setItem(key, value);
  } catch {
    // A blocked or full localStorage must never prevent joining a meeting.
  }
}

function safeRemove(storage: ParticipantStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // A blocked localStorage is treated like an empty store.
  }
}
