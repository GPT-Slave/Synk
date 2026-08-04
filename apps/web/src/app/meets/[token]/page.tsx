"use client";

import type { ParticipantSessionDto } from "@meet-planner/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
  Plus,
  RotateCcw,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { AvailabilityGrid } from "@/components/meetings/availability-grid";
import { MeetingScheduledCard } from "@/components/meetings/meeting-scheduled-card";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/auth-api";
import {
  getParticipantSession,
  getPublicMeeting,
  joinMeeting,
} from "@/lib/meeting-api";
import {
  clearActiveParticipantToken,
  findMeetingParticipantSession,
  getActiveParticipantToken,
  normalizeDisplayName,
  PARTICIPANT_STORAGE_EVENT,
  participantInvitationView,
  participantStorageSnapshot,
  readMeetingParticipantSessions,
  readRememberedNames,
  rememberParticipantSession,
  removeMeetingParticipantSession,
  setActiveParticipantToken,
  type StoredParticipantSession,
} from "@/lib/participant-invitation-state";

export default function PublicMeetingPage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const {
    meetingSessions,
    rememberedNames,
    sessionToken: storedSessionToken,
  } = useParticipantStorage(token);
  const [ephemeralSession, setEphemeralSession] = useState<{
    meetingToken: string;
    sessionToken: string;
  }>();
  const sessionToken =
    storedSessionToken ??
    (ephemeralSession?.meetingToken === token
      ? ephemeralSession.sessionToken
      : undefined);
  const [confirmedSession, setConfirmedSession] = useState<{
    meetingToken: string;
    sessionToken: string;
  }>();
  const identityConfirmed =
    confirmedSession?.meetingToken === token &&
    confirmedSession.sessionToken === sessionToken;
  const meeting = useQuery({
    queryKey: ["public-meeting", token],
    queryFn: () => getPublicMeeting(token),
    refetchInterval: 15_000,
  });
  const participant = useQuery({
    queryKey: ["participant-session", token, sessionToken],
    queryFn: () => getParticipantSession(token, sessionToken!),
    enabled: Boolean(sessionToken),
    retry: false,
  });

  useEffect(() => {
    if (
      participant.error instanceof ApiError &&
      participant.error.status === 401 &&
      sessionToken
    ) {
      removeMeetingParticipantSession(localStorage, token, sessionToken);
      notifyParticipantStorage();
    }
  }, [participant.error, sessionToken, token]);

  useEffect(() => {
    if (!participant.data || !sessionToken) return;
    const before = participantStorageSnapshot(localStorage, token);
    rememberParticipantSession(localStorage, token, {
      displayName: participant.data.participant.displayName,
      sessionToken,
    });
    if (participantStorageSnapshot(localStorage, token) !== before) {
      notifyParticipantStorage();
    }
  }, [participant.data, sessionToken, token]);

  if (meeting.isPending) return <MeetingLoading />;
  if (meeting.isError) {
    return <InvalidInvitation />;
  }

  const participantSession = participant.data;
  const unauthorized =
    participant.error instanceof ApiError && participant.error.status === 401;
  const invitationView = participantInvitationView({
    hasSessionToken: Boolean(sessionToken),
    hasParticipantSession: Boolean(participantSession),
    identityConfirmed,
    sessionStatus: participant.status,
    unauthorized,
  });
  const usableMeetingSessions =
    unauthorized && sessionToken
      ? meetingSessions.filter(
          (storedSession) => storedSession.sessionToken !== sessionToken,
        )
      : meetingSessions;

  function activateStoredSession(nextToken: string) {
    setActiveParticipantToken(localStorage, token, nextToken);
    setEphemeralSession({ meetingToken: token, sessionToken: nextToken });
    setConfirmedSession({ meetingToken: token, sessionToken: nextToken });
    notifyParticipantStorage();
  }

  function chooseAnotherParticipant() {
    clearActiveParticipantToken(localStorage, token);
    setEphemeralSession(undefined);
    setConfirmedSession(undefined);
    notifyParticipantStorage();
  }

  function joined(nextSession: ParticipantSessionDto, nextToken: string) {
    rememberParticipantSession(localStorage, token, {
      displayName: nextSession.participant.displayName,
      sessionToken: nextToken,
    });
    queryClient.setQueryData(
      ["participant-session", token, nextToken],
      nextSession,
    );
    setEphemeralSession({ meetingToken: token, sessionToken: nextToken });
    setConfirmedSession({ meetingToken: token, sessionToken: nextToken });
    notifyParticipantStorage();
  }

  return (
    <main className="min-h-svh px-5 py-6 sm:px-8">
      <nav className="mx-auto flex max-w-6xl items-center border-b border-white/10 pb-5">
        <Link className="flex items-center gap-3" href="/">
          <Image
            alt=""
            className="brand-neon-blue size-10 rounded-xl"
            height={64}
            src="/logo.png"
            width={64}
          />
          <span className="text-lg font-semibold tracking-tight">Synk</span>
        </Link>
      </nav>

      <section className="mx-auto max-w-6xl py-10 sm:py-14">
        <p className="text-sm font-medium text-primary">Synk invitation</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          {meeting.data.title}
        </h1>
        {meeting.data.description && (
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            {meeting.data.description}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            {formatDate(meeting.data.startDate)} –{" "}
            {formatDate(meeting.data.endDate)}
          </span>
          <span className="flex items-center gap-2">
            <Clock3 className="size-4 text-primary" />
            {meeting.data.workdayStart}–{meeting.data.workdayEnd} ·{" "}
            {meeting.data.timezone} · {meeting.data.slotIntervalMinutes}-minute
            slots
          </span>
        </div>

        {meeting.data.finalized && (
          <MeetingScheduledCard meeting={meeting.data} />
        )}

        {!meeting.data.acceptingResponses && !meeting.data.finalized && (
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-blue-100">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Responses are closed</p>
              <p className="mt-1 text-blue-100/75">
                {meeting.data.closedReason}
              </p>
            </div>
          </div>
        )}

        {!meeting.data.finalized && invitationView === "restoring" && (
          <div className="mt-12 flex items-center gap-3 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin text-primary" />{" "}
            Restoring your response…
          </div>
        )}

        {!meeting.data.finalized &&
          invitationView === "confirm-identity" &&
          participantSession && (
            <ReturningParticipantPrompt
              displayName={participantSession.participant.displayName}
              onChooseAnother={chooseAnotherParticipant}
              onContinue={() =>
                setConfirmedSession({
                  meetingToken: token,
                  sessionToken: sessionToken!,
                })
              }
            />
          )}

        {!meeting.data.finalized &&
          invitationView === "availability" &&
          participantSession &&
          sessionToken && (
            <AvailabilityGrid
              key={participantSession.participant.id}
              meeting={meeting.data}
              participantSession={participantSession}
              sessionToken={sessionToken}
              token={token}
            />
          )}

        {!meeting.data.finalized &&
          invitationView === "join" &&
          meeting.data.acceptingResponses && (
            <JoinForm
              meetingSessions={usableMeetingSessions}
              onJoined={joined}
              onResume={activateStoredSession}
              rememberedNames={rememberedNames}
              token={token}
            />
          )}

        {!meeting.data.finalized && invitationView === "restore-error" && (
          <SessionRestoreError
            onChooseAnother={chooseAnotherParticipant}
            onRetry={() => void participant.refetch()}
          />
        )}
      </section>
    </main>
  );
}

function JoinForm({
  meetingSessions,
  onJoined,
  onResume,
  rememberedNames,
  token,
}: {
  meetingSessions: StoredParticipantSession[];
  onJoined: (session: ParticipantSessionDto, sessionToken: string) => void;
  onResume: (sessionToken: string) => void;
  rememberedNames: string[];
  token: string;
}) {
  const [displayName, setDisplayName] = useState("");
  const [entryMode, setEntryMode] = useState<"choose" | "new">("choose");
  const [clientError, setClientError] = useState<string>();
  const mutation = useMutation({
    mutationFn: (name: string) => joinMeeting(token, name),
    onSuccess: ({ sessionToken, ...session }) =>
      onJoined(session, sessionToken),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.reset();
    const normalized = normalizeDisplayName(displayName);
    if (normalized.length < 2 || normalized.length > 30) {
      setClientError("Choose or enter a name between 2 and 30 characters.");
      return;
    }
    setClientError(undefined);
    const storedSession = findMeetingParticipantSession(
      meetingSessions,
      normalized,
    );
    if (storedSession) {
      onResume(storedSession.sessionToken);
      return;
    }
    mutation.mutate(normalized);
  }

  const apiError =
    mutation.error instanceof ApiError ? mutation.error : undefined;
  const suggestions = Array.isArray(apiError?.details?.suggestions)
    ? (apiError.details.suggestions as string[])
    : [];

  return (
    <form
      className="mt-10 max-w-lg rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7"
      noValidate
      onSubmit={submit}
    >
      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <UserRound className="size-5" />
      </div>
      <h2 className="mt-5 text-xl font-semibold">Who&apos;s responding?</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose a name saved on this device or enter a new one. Next, you&apos;ll
        select your available hours directly on the calendar.
      </p>

      {rememberedNames.length > 0 && entryMode === "choose" ? (
        <div className="mt-6">
          <p className="text-sm font-medium">Saved on this device</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {rememberedNames.map((name) => {
              const selected = displayName === name;
              const hasSavedResponse = Boolean(
                findMeetingParticipantSession(meetingSessions, name),
              );
              return (
                <button
                  aria-pressed={selected}
                  className={`group flex min-h-14 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition duration-200 ${
                    selected
                      ? "border-primary/70 bg-primary/15 text-white shadow-[0_0_24px_oklch(0.7_0.16_240_/_0.12)]"
                      : "border-white/10 bg-white/[0.025] text-muted-foreground hover:border-primary/35 hover:bg-primary/[0.07] hover:text-white"
                  }`}
                  key={name}
                  onClick={() => {
                    mutation.reset();
                    setClientError(undefined);
                    setDisplayName(name);
                  }}
                  type="button"
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/[0.06] text-blue-100"
                    }`}
                  >
                    {selected ? <Check className="size-4" /> : initials(name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {name}
                    </span>
                    <span className="block text-[0.68rem] text-muted-foreground">
                      {hasSavedResponse
                        ? "Saved response found"
                        : "Use this name"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:text-blue-200"
            onClick={() => {
              mutation.reset();
              setClientError(undefined);
              setDisplayName("");
              setEntryMode("new");
            }}
            type="button"
          >
            <Plus className="size-4" /> Enter a new name
          </button>
        </div>
      ) : (
        <div className="mt-6">
          <label className="block text-sm font-medium" htmlFor="display-name">
            Display name
          </label>
          <input
            aria-describedby={
              clientError || apiError ? "join-error" : "name-storage-note"
            }
            aria-invalid={Boolean(clientError || apiError)}
            autoComplete="nickname"
            autoFocus={rememberedNames.length > 0}
            className="auth-input mt-2"
            id="display-name"
            maxLength={30}
            minLength={2}
            onChange={(event) => {
              mutation.reset();
              setClientError(undefined);
              setDisplayName(event.target.value);
            }}
            placeholder="Dhia"
            value={displayName}
          />
          <p
            className="mt-2 text-xs text-muted-foreground"
            id="name-storage-note"
          >
            Your name will be remembered only on this device.
          </p>
          {rememberedNames.length > 0 && (
            <button
              className="mt-3 text-sm font-medium text-primary transition hover:text-blue-200"
              onClick={() => {
                mutation.reset();
                setClientError(undefined);
                setDisplayName("");
                setEntryMode("choose");
              }}
              type="button"
            >
              Choose a saved name instead
            </button>
          )}
        </div>
      )}
      {(clientError || apiError) && (
        <div
          className="mt-2 text-xs text-blue-300"
          id="join-error"
          role="alert"
        >
          <p>{clientError ?? apiError?.message}</p>
          {suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  className="rounded-full border border-primary/30 px-2.5 py-1 text-blue-100 transition hover:bg-primary/10"
                  key={suggestion}
                  onClick={() => {
                    mutation.reset();
                    setClientError(undefined);
                    setEntryMode("new");
                    setDisplayName(suggestion);
                  }}
                  type="button"
                >
                  Try {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <Button
        className="mt-5 h-10 w-full"
        disabled={mutation.isPending || !displayName.trim()}
        type="submit"
      >
        {mutation.isPending && <LoaderCircle className="animate-spin" />}{" "}
        {findMeetingParticipantSession(meetingSessions, displayName)
          ? "Open my saved availability"
          : "Continue to availability"}
      </Button>
    </form>
  );
}

function ReturningParticipantPrompt({
  displayName,
  onChooseAnother,
  onContinue,
}: {
  displayName: string;
  onChooseAnother: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="mt-10 max-w-lg rounded-2xl border border-primary/25 bg-primary/[0.07] p-5 shadow-[0_0_40px_oklch(0.7_0.16_240_/_0.08)] sm:p-7">
      <div className="grid size-11 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {initials(displayName)}
      </div>
      <p className="mt-5 text-sm font-medium text-primary">Welcome back</p>
      <h2 className="mt-1 text-2xl font-semibold">
        Continue as {displayName}?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        We found your response on this device. Continue to review or update your
        availability.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button className="sm:flex-1" onClick={onContinue} type="button">
          <Check /> Continue as {displayName}
        </Button>
        <Button onClick={onChooseAnother} type="button" variant="outline">
          Use another name
        </Button>
      </div>
    </section>
  );
}

function SessionRestoreError({
  onChooseAnother,
  onRetry,
}: {
  onChooseAnother: () => void;
  onRetry: () => void;
}) {
  return (
    <section className="mt-10 max-w-lg rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
      <AlertCircle className="size-6 text-primary" />
      <h2 className="mt-4 text-xl font-semibold">
        We couldn&apos;t restore your response
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Check your connection and try again. You can also continue with a
        different participant name.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={onRetry} type="button">
          <RotateCcw /> Try again
        </Button>
        <Button onClick={onChooseAnother} type="button" variant="outline">
          Choose a name
        </Button>
      </div>
    </section>
  );
}

function InvalidInvitation() {
  return (
    <main className="grid min-h-svh place-items-center px-5 text-center">
      <div className="max-w-md">
        <AlertCircle className="mx-auto size-9 text-primary" />
        <h1 className="mt-5 text-3xl font-semibold">Invitation not found</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          This link is invalid, expired, or the organizer deleted the meeting.
          Ask the organizer for a fresh invitation.
        </p>
        <Button className="mt-7" render={<Link href="/" />} variant="outline">
          Return to Synk
        </Button>
      </div>
    </main>
  );
}

function MeetingLoading() {
  return (
    <main className="mx-auto min-h-svh max-w-6xl px-5 py-20" role="status">
      <div className="h-6 w-28 animate-pulse rounded bg-white/5" />
      <div className="mt-5 h-12 max-w-2xl animate-pulse rounded bg-white/5" />
      <div className="mt-8 h-72 animate-pulse rounded-2xl bg-white/[0.035]" />
      <span className="sr-only">Loading invitation…</span>
    </main>
  );
}

function useParticipantStorage(token: string) {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("storage", notify);
    window.addEventListener(PARTICIPANT_STORAGE_EVENT, notify);
    return () => {
      window.removeEventListener("storage", notify);
      window.removeEventListener(PARTICIPANT_STORAGE_EVENT, notify);
    };
  }, []);
  const getSnapshot = useCallback(
    () => participantStorageSnapshot(localStorage, token),
    [token],
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  return useMemo(() => {
    if (!snapshot || typeof window === "undefined") {
      return {
        meetingSessions: [] as StoredParticipantSession[],
        rememberedNames: [] as string[],
        sessionToken: undefined as string | undefined,
      };
    }
    return {
      meetingSessions: readMeetingParticipantSessions(localStorage, token),
      rememberedNames: readRememberedNames(localStorage),
      sessionToken: getActiveParticipantToken(localStorage, token),
    };
  }, [snapshot, token]);
}

function notifyParticipantStorage() {
  window.dispatchEvent(new Event(PARTICIPANT_STORAGE_EVENT));
}

function initials(displayName: string) {
  return normalizeDisplayName(displayName)
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("en-US"))
    .join("");
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
