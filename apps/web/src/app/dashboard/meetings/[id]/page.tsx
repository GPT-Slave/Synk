"use client";

import type { BestMatchDto } from "@meet-planner/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarCheck2,
  CalendarDays,
  Check,
  Copy,
  Flame,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  UnlockKeyhole,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  AvailabilityGrid,
  type AvailabilityResponse,
} from "@/components/meetings/availability-grid";
import { BestTimeSuggestions } from "@/components/meetings/best-time-suggestions";
import { HeatmapGrid } from "@/components/meetings/heatmap-grid";
import { MeetingScheduledCard } from "@/components/meetings/meeting-scheduled-card";
import { OrganizerShell } from "@/components/organizer-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MotionPanel } from "@/components/ui/motion-panel";
import { StatePanel } from "@/components/ui/state-panel";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useMeetingRealtime } from "@/hooks/use-meeting-realtime";
import { ApiError } from "@/lib/auth-api";
import {
  deleteMeeting,
  finalizeMeeting,
  getMeeting,
  reopenMeeting,
  saveOrganizerAvailability,
  setMeetingLocked,
} from "@/lib/meeting-api";

export default function MeetingDetailPage() {
  return (
    <OrganizerShell>
      <MeetingDetail />
    </OrganizerShell>
  );
}

function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<BestMatchDto>();
  const toast = useToast();
  const realtimeStatus = useMeetingRealtime(id);
  const meeting = useQuery({
    queryKey: ["meetings", id],
    queryFn: () => getMeeting(id),
  });

  async function refreshMeeting() {
    await queryClient.invalidateQueries({ queryKey: ["meetings"] });
  }

  const remove = useMutation({
    mutationFn: () => deleteMeeting(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast({
        title: "Meeting deleted",
        description: "The invitation and all responses were removed.",
        variant: "success",
      });
      router.replace("/dashboard");
    },
  });
  const lock = useMutation({
    mutationFn: (locked: boolean) => setMeetingLocked(id, locked),
    onSuccess: async (_saved, locked) => {
      await refreshMeeting();
      toast({
        title: locked ? "Responses locked" : "Responses reopened",
        description: locked
          ? "Participants can view the invitation but cannot edit responses."
          : "Participants can edit their availability again.",
        variant: "success",
      });
    },
  });
  const reopen = useMutation({
    mutationFn: () => reopenMeeting(id),
    onSuccess: async () => {
      await refreshMeeting();
      toast({
        title: "Meeting reopened",
        description: "Finalization was removed and responses are open again.",
        variant: "success",
      });
    },
  });
  const finalize = useMutation({
    mutationFn: (match: BestMatchDto) =>
      finalizeMeeting(id, {
        datetimeStart: match.datetimeStart,
        datetimeEnd: match.datetimeEnd,
      }),
    onSuccess: async () => {
      setSelectedMatch(undefined);
      await refreshMeeting();
      toast({
        title: "Meeting scheduled",
        description: "The confirmed time is now visible to every participant.",
        variant: "success",
      });
    },
  });

  if (meeting.isPending) {
    return <DashboardSkeleton />;
  }
  if (meeting.isError) {
    return (
      <section className="mx-auto max-w-7xl py-16">
        <StatePanel
          description="It may have been deleted, or it belongs to another organizer."
          kind="error"
          onRetry={() => void meeting.refetch()}
          title="Meeting not found"
        />
      </section>
    );
  }

  const data = meeting.data;
  async function copyInviteLink() {
    try {
      const inviteUrl = `${window.location.origin}/meets/${data.slug}`;
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast({
        title: "Invitation copied",
        description: "The private Synk link is ready to share.",
        variant: "success",
      });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({
        title: "Could not copy the link",
        description:
          "Your browser blocked clipboard access. Copy it from the address bar instead.",
        variant: "error",
      });
    }
  }

  const actionError = [lock.error, reopen.error, finalize.error, remove.error]
    .filter(Boolean)
    .map((error) =>
      error instanceof ApiError
        ? error.message
        : "That action did not complete.",
    )[0];

  return (
    <section className="mx-auto max-w-7xl py-8 sm:py-12">
      <Link
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        href="/dashboard"
      >
        <ArrowLeft className="size-4" /> All meetings
      </Link>

      <div className="mt-7 flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {data.title}
            </h1>
            <MeetingBadge meeting={data} />
            <LiveStatus status={realtimeStatus} />
          </div>
          {data.description && (
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
              {data.description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!data.finalized && (
            <>
              <Button
                disabled={lock.isPending}
                onClick={() => lock.mutate(!data.locked)}
                type="button"
                variant="outline"
              >
                {lock.isPending ? (
                  <LoaderCircle className="animate-spin" />
                ) : data.locked ? (
                  <UnlockKeyhole />
                ) : (
                  <LockKeyhole />
                )}
                {data.locked ? "Open responses" : "Lock responses"}
              </Button>
              <Button
                render={<Link href={`/dashboard/meetings/${id}/edit`} />}
                variant="outline"
              >
                <Pencil /> Edit
              </Button>
            </>
          )}
          {data.finalized && (
            <Button
              disabled={reopen.isPending}
              onClick={() => reopen.mutate()}
              type="button"
              variant="outline"
            >
              {reopen.isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <UnlockKeyhole />
              )}
              Re-open meeting
            </Button>
          )}
          <Button onClick={copyInviteLink} type="button">
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy invite"}
          </Button>
          <Button
            aria-label="Delete meeting"
            disabled={remove.isPending}
            onClick={() => setDeleteOpen(true)}
            size="icon"
            type="button"
            variant="destructive"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this meeting?</DialogTitle>
            <DialogDescription>
              This permanently removes the invitation, participant names,
              comments, and every availability response. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={remove.isPending}
              onClick={() => setDeleteOpen(false)}
              type="button"
              variant="outline"
            >
              Keep meeting
            </Button>
            <Button
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
              type="button"
              variant="destructive"
            >
              {remove.isPending && <LoaderCircle className="animate-spin" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {actionError && (
        <p
          className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100"
          role="alert"
        >
          {actionError}
        </p>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <InfoCard
          icon={<CalendarDays />}
          label="Date range"
          value={`${formatDate(data.startDate)} – ${formatDate(data.endDate)}`}
        />
        <InfoCard
          icon={<UsersRound />}
          label="Responses"
          value={`${data.responseCount} / ${data.participantCount}`}
        />
        <InfoCard
          icon={<Link2 />}
          label="Schedule"
          value={`${data.timezone} · ${data.workdayStart}–${data.workdayEnd} · ${data.slotIntervalMinutes} min`}
        />
      </div>

      {data.finalized && <MeetingScheduledCard meeting={data} />}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.75fr)]">
        <div className="space-y-6">
          {!data.finalized && (
            <DashboardSection
              icon={<CalendarCheck2 />}
              title="Your availability"
            >
              <AvailabilityGrid
                meeting={data}
                mode="organizer"
                onSave={(response: AvailabilityResponse) =>
                  saveOrganizerAvailability(id, response).then(
                    async (saved) => {
                      await refreshMeeting();
                      return saved;
                    },
                  )
                }
                participantSession={data.organizerAvailability}
                saveScope={`organizer-availability:${id}`}
              />
            </DashboardSection>
          )}

          <DashboardSection icon={<Flame />} title="Live availability heatmap">
            <HeatmapGrid meeting={data} />
          </DashboardSection>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6">
          <DashboardSection
            action={
              <Button
                aria-label="Refresh suggestions"
                disabled={meeting.isFetching}
                onClick={() => meeting.refetch()}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <RefreshCw
                  className={meeting.isFetching ? "animate-spin" : ""}
                />
              </Button>
            }
            icon={<Sparkles />}
            title="Top matches"
          >
            <BestTimeSuggestions
              matches={data.bestTimes}
              onSelect={data.finalized ? undefined : setSelectedMatch}
              timezone={data.timezone}
            />
            {selectedMatch && (
              <FinalizeChoice
                isPending={finalize.isPending}
                match={selectedMatch}
                onCancel={() => setSelectedMatch(undefined)}
                onConfirm={() => finalize.mutate(selectedMatch)}
                timezone={data.timezone}
              />
            )}
          </DashboardSection>

          <DashboardSection icon={<UsersRound />} title="Participants">
            {data.participants.length === 0 ? (
              <StatePanel
                className="min-h-36"
                description="Add your availability or share the invite link to collect the first response."
                icon={<UsersRound />}
                title="No responses yet"
              />
            ) : (
              <ul className="divide-y divide-white/10">
                {data.participants.map((participant) => (
                  <li
                    className="flex items-start justify-between gap-3 py-3"
                    key={participant.id}
                  >
                    <div className="min-w-0">
                      <p className="text-sm">
                        {participant.isOrganizer
                          ? "You (organizer)"
                          : participant.displayName}
                      </p>
                      {participant.comment && (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          “{participant.comment}”
                        </p>
                      )}
                    </div>
                    <span
                      className={
                        participant.responded
                          ? "shrink-0 text-xs text-primary"
                          : "shrink-0 text-xs text-muted-foreground"
                      }
                    >
                      {participant.responded ? "Responded" : "Not answered"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardSection>
        </aside>
      </div>
    </section>
  );
}

function FinalizeChoice({
  isPending,
  match,
  onCancel,
  onConfirm,
  timezone,
}: {
  isPending: boolean;
  match: BestMatchDto;
  onCancel: () => void;
  onConfirm: () => void;
  timezone: string;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-primary/35 bg-primary/[0.09] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
        Final confirmation
      </p>
      <p className="mt-2 text-sm font-medium">
        {formatLongDate(match.datetimeStart, timezone)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatTime(match.datetimeStart, timezone)}–
        {formatTime(match.datetimeEnd, timezone)} · {match.percentage}%
        available
      </p>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Finalizing locks every response and shows this confirmed time to all
        participants.
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={onCancel} type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={isPending} onClick={onConfirm} type="button">
          {isPending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <CalendarCheck2 />
          )}
          Finalize meeting
        </Button>
      </div>
    </div>
  );
}

function MeetingBadge({
  meeting,
}: {
  meeting: { finalized: boolean; locked: boolean };
}) {
  if (!meeting.finalized && !meeting.locked) return null;
  return (
    <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
      {meeting.finalized ? "Finalized" : "Responses locked"}
    </span>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <MotionPanel className="rounded-lg border border-white/10 bg-white/[0.025] p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-primary">
        {icon} {label}
      </div>
      <p className="mt-3 text-sm font-medium">{value}</p>
    </MotionPanel>
  );
}

function DashboardSection({
  action,
  children,
  icon,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <MotionPanel className="rounded-lg border border-white/10 bg-white/[0.025] p-4 shadow-md sm:p-6">
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-medium [&_svg]:size-4 [&_svg]:text-primary">
            {icon} {title}
          </h2>
          {action}
        </div>
        <div className="mt-5">{children}</div>
      </section>
    </MotionPanel>
  );
}

function LiveStatus({ status }: { status: "connecting" | "live" | "offline" }) {
  const label = {
    connecting: "Connecting",
    live: "Live",
    offline: "Reconnecting",
  }[status];
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs text-muted-foreground">
      <span
        className={`size-1.5 rounded-full ${
          status === "live"
            ? "bg-primary shadow-[0_0_10px_oklch(0.86_0.24_145)]"
            : "animate-pulse bg-white/35"
        }`}
      />
      {label}
    </span>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatLongDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).format(new Date(value));
}
