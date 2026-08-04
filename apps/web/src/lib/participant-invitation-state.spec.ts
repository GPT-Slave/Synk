import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearActiveParticipantToken,
  findMeetingParticipantSession,
  getActiveParticipantToken,
  participantInvitationView,
  readMeetingParticipantSessions,
  readRememberedNames,
  rememberParticipantName,
  rememberParticipantSession,
  removeMeetingParticipantSession,
  type ParticipantStorage,
} from "./participant-invitation-state";

describe("participant invitation state", () => {
  it("shows the join form for a first-time visitor even when the disabled query is pending", () => {
    assert.equal(
      participantInvitationView({
        hasSessionToken: false,
        hasParticipantSession: false,
        identityConfirmed: false,
        sessionStatus: "pending",
        unauthorized: false,
      }),
      "join",
    );
  });

  it("restores, confirms, and opens a returning participant in explicit states", () => {
    assert.equal(
      participantInvitationView({
        hasSessionToken: true,
        hasParticipantSession: false,
        identityConfirmed: false,
        sessionStatus: "pending",
        unauthorized: false,
      }),
      "restoring",
    );
    assert.equal(
      participantInvitationView({
        hasSessionToken: true,
        hasParticipantSession: true,
        identityConfirmed: false,
        sessionStatus: "success",
        unauthorized: false,
      }),
      "confirm-identity",
    );
    assert.equal(
      participantInvitationView({
        hasSessionToken: true,
        hasParticipantSession: true,
        identityConfirmed: true,
        sessionStatus: "success",
        unauthorized: false,
      }),
      "availability",
    );
  });

  it("falls back to joining for an invalid stored session", () => {
    assert.equal(
      participantInvitationView({
        hasSessionToken: true,
        hasParticipantSession: false,
        identityConfirmed: false,
        sessionStatus: "error",
        unauthorized: true,
      }),
      "join",
    );
  });
});

describe("participant identity storage", () => {
  it("remembers names case-insensitively and ignores damaged storage", () => {
    const storage = new MemoryStorage();
    storage.setItem("synk:participant-names:v1", "not json");
    assert.deepEqual(readRememberedNames(storage), []);

    rememberParticipantName(storage, "  Alice   Dev  ");
    rememberParticipantName(storage, "alice dev");
    rememberParticipantName(storage, "Bob");
    assert.deepEqual(readRememberedNames(storage), ["Bob", "alice dev"]);
  });

  it("stores separate participant sessions for a shared device", () => {
    const storage = new MemoryStorage();
    const firstToken = "a".repeat(43);
    const secondToken = "b".repeat(43);

    rememberParticipantSession(storage, "meeting", {
      displayName: "Alice",
      sessionToken: firstToken,
    });
    rememberParticipantSession(storage, "meeting", {
      displayName: "Bob",
      sessionToken: secondToken,
    });

    const sessions = readMeetingParticipantSessions(storage, "meeting");
    assert.equal(sessions.length, 2);
    assert.equal(
      findMeetingParticipantSession(sessions, "ALICE")?.sessionToken,
      firstToken,
    );
    assert.equal(getActiveParticipantToken(storage, "meeting"), secondToken);

    removeMeetingParticipantSession(storage, "meeting", secondToken);
    assert.equal(getActiveParticipantToken(storage, "meeting"), undefined);
    assert.deepEqual(readMeetingParticipantSessions(storage, "meeting"), [
      { displayName: "Alice", sessionToken: firstToken },
    ]);
  });

  it("reads and clears the legacy active-session key", () => {
    const storage = new MemoryStorage();
    const token = "c".repeat(43);
    storage.setItem("calendra:participant:meeting", token);
    assert.equal(getActiveParticipantToken(storage, "meeting"), token);
    clearActiveParticipantToken(storage, "meeting");
    assert.equal(getActiveParticipantToken(storage, "meeting"), undefined);
  });
});

class MemoryStorage implements ParticipantStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}
