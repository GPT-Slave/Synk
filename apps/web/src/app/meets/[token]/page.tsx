"use client";

import type { ParticipantSessionDto } from "@meet-planner/shared-types";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarDays,
  Clock3,
  LoaderCircle,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { AvailabilityGrid } from "@/components/meetings/availability-grid";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/auth-api";
import {
  getParticipantSession,
  getPublicMeeting,
  joinMeeting,
} from "@/lib/meeting-api";

export default function PublicMeetingPage() {
  const { token } = useParams<{ token: string }>();
  const sessionToken = useParticipantToken(token);
  const meeting = useQuery({
    queryKey: ["public-meeting", token],
    queryFn: () => getPublicMeeting(token),
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
      participant.error.status === 401
    ) {
      localStorage.removeItem(storageKey(token));
      window.dispatchEvent(new Event(PARTICIPANT_SESSION_EVENT));
    }
  }, [participant.error, token]);

  if (meeting.isPending) return <MeetingLoading />;
  if (meeting.isError) {
    return <InvalidInvitation />;
  }

  const participantSession = participant.data;
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
          <span className="text-lg font-semibold tracking-tight">Calendra</span>
        </Link>
      </nav>

      <section className="mx-auto max-w-6xl py-10 sm:py-14">
        <p className="text-sm font-medium text-primary">You’re invited</p>
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

        {!meeting.data.acceptingResponses && (
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

        {sessionToken && participant.isPending && (
          <div className="mt-12 flex items-center gap-3 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin text-primary" />{" "}
            Restoring your response…
          </div>
        )}

        {participantSession && sessionToken ? (
          <AvailabilityGrid
            meeting={meeting.data}
            participantSession={participantSession}
            sessionToken={sessionToken}
            token={token}
          />
        ) : (
          meeting.data.acceptingResponses &&
          !participant.isPending && (
            <JoinForm
              onJoined={(nextSession, nextToken) => {
                localStorage.setItem(storageKey(token), nextToken);
                window.dispatchEvent(new Event(PARTICIPANT_SESSION_EVENT));
              }}
              token={token}
            />
          )
        )}
      </section>
    </main>
  );
}

function JoinForm({
  onJoined,
  token,
}: {
  onJoined: (session: ParticipantSessionDto, sessionToken: string) => void;
  token: string;
}) {
  const [displayName, setDisplayName] = useState("");
  const [clientError, setClientError] = useState<string>();
  const mutation = useMutation({
    mutationFn: () => joinMeeting(token, displayName),
    onSuccess: ({ sessionToken, ...session }) =>
      onJoined(session, sessionToken),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.reset();
    const normalized = displayName.trim().replace(/\s+/g, " ");
    if (normalized.length < 2 || normalized.length > 30) {
      setClientError("Use a display name between 2 and 30 characters.");
      return;
    }
    setClientError(undefined);
    mutation.mutate();
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
      <h2 className="mt-5 text-xl font-semibold">Add your availability</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        No account needed. Choose a name that is unique in this meeting.
      </p>
      <label className="mt-6 block text-sm font-medium" htmlFor="display-name">
        Display name
      </label>
      <input
        aria-describedby={clientError || apiError ? "join-error" : undefined}
        aria-invalid={Boolean(clientError || apiError)}
        autoComplete="nickname"
        className="auth-input mt-2"
        id="display-name"
        maxLength={30}
        minLength={2}
        onChange={(event) => setDisplayName(event.target.value)}
        placeholder="Dhia"
        value={displayName}
      />
      {(clientError || apiError) && (
        <div className="mt-2 text-xs text-blue-300" id="join-error" role="alert">
          <p>{clientError ?? apiError?.message}</p>
          {suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  className="rounded-full border border-primary/30 px-2.5 py-1 text-blue-100 transition hover:bg-primary/10"
                  key={suggestion}
                  onClick={() => setDisplayName(suggestion)}
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
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending && <LoaderCircle className="animate-spin" />}{" "}
        Continue
      </Button>
    </form>
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
          Return to Calendra
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

function storageKey(token: string) {
  return `calendra:participant:${token}`;
}

const PARTICIPANT_SESSION_EVENT = "calendra-participant-session";

function useParticipantToken(token: string) {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("storage", notify);
    window.addEventListener(PARTICIPANT_SESSION_EVENT, notify);
    return () => {
      window.removeEventListener("storage", notify);
      window.removeEventListener(PARTICIPANT_SESSION_EVENT, notify);
    };
  }, []);
  const getSnapshot = useCallback(
    () => localStorage.getItem(storageKey(token)) ?? undefined,
    [token],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
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
