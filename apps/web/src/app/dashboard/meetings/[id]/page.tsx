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
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UnlockKeyhole,
  UserMinus,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type { AvailabilityResponse } from "@/components/meetings/availability-grid";
import { BestTimeSuggestions } from "@/components/meetings/best-time-suggestions";
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
  deleteParticipant,
  finalizeMeeting,
  getMeeting,
  reopenMeeting,
  saveOrganizerAvailability,
  setMeetingLocked,
} from "@/lib/meeting-api";
import { useI18n } from "@/lib/i18n";

const AvailabilityGrid = dynamic(
  () =>
    import("@/components/meetings/availability-grid").then(
      (module) => module.AvailabilityGrid,
    ),
  { loading: () => <GridLoadingState label="availability calendar" /> },
);

export default function MeetingDetailPage() {
  return (
    <OrganizerShell>
      <MeetingDetail />
    </OrganizerShell>
  );
}

function MeetingDetail() {
  const { formatDate, formatDuration, t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [participantToDelete, setParticipantToDelete] = useState<{
    id: string;
    displayName: string;
  }>();
  const [selectedMatch, setSelectedMatch] = useState<BestMatchDto>();
  const [manualSelection, setManualSelection] = useState(false);
  const [highlightedMatch, setHighlightedMatch] = useState<BestMatchDto>();
  const [highlightedParticipantIds, setHighlightedParticipantIds] = useState<string[]>([]);
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
        title: t("Meeting deleted"),
        description: t("The invitation and all responses were removed."),
        variant: "success",
      });
      router.replace("/dashboard");
    },
  });
  const removeParticipant = useMutation({
    mutationFn: (participantId: string) => deleteParticipant(id, participantId),
    onSuccess: async () => {
      const displayName = participantToDelete?.displayName;
      setParticipantToDelete(undefined);
      await refreshMeeting();
      toast({
        title: t("Participant removed"),
        description: displayName
          ? t("{name} and their availability were removed.", { name: displayName })
          : t("The participant and their availability were removed."),
        variant: "success",
      });
    },
  });
  const lock = useMutation({
    mutationFn: (locked: boolean) => setMeetingLocked(id, locked),
    onSuccess: async (_saved, locked) => {
      await refreshMeeting();
      toast({
        title: locked ? t("Responses locked") : t("Responses reopened"),
        description: locked
          ? t("Participants can view the invitation but cannot edit responses.")
          : t("Participants can edit their availability again."),
        variant: "success",
      });
    },
  });
  const reopen = useMutation({
    mutationFn: () => reopenMeeting(id),
    onSuccess: async () => {
      await refreshMeeting();
      toast({
        title: t("Meeting reopened"),
        description: t("Finalization was removed and responses are open again."),
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
        title: t("Meeting scheduled"),
        description: t("The confirmed time is now visible to every participant."),
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
          description={t("It may have been deleted, or it belongs to another organizer.")}
          kind="error"
          onRetry={() => void meeting.refetch()}
          title={t("Meeting not found")}
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
        title: t("Invitation copied"),
        description: t("The private Synk link is ready to share."),
        variant: "success",
      });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({
        title: t("Could not copy the link"),
        description: t(
          "Your browser blocked clipboard access. Copy it from the address bar instead.",
        ),
        variant: "error",
      });
    }
  }

  const actionError = [
    lock.error,
    reopen.error,
    finalize.error,
    remove.error,
    removeParticipant.error,
  ]
    .filter(Boolean)
    .map((error) =>
      error instanceof ApiError ? error.message : t("That action did not complete."),
    )[0];

  return (
    <section className="mx-auto max-w-7xl py-8 sm:py-12">
      <Link
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        href="/dashboard"
      >
        <ArrowLeft className="size-4" /> {t("All meetings")}
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
                {data.locked ? t("Open responses") : t("Lock responses")}
              </Button>
              <Button
                render={<Link href={`/dashboard/meetings/${id}/edit`} />}
                variant="outline"
              >
                <Pencil /> {t("Edit")}
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
              {t("Re-open meeting")}
            </Button>
          )}
          <Button onClick={copyInviteLink} type="button">
            {copied ? <Check /> : <Copy />}{" "}
            {copied ? t("Copied") : t("Copy invite")}
          </Button>
          <Button
            aria-label={t("Delete meeting")}
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
            <DialogTitle>{t("Delete this meeting?")}</DialogTitle>
            <DialogDescription>
              {t(
                "This permanently removes the invitation, participant names, comments, and every availability response. This cannot be undone.",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={remove.isPending}
              onClick={() => setDeleteOpen(false)}
              type="button"
              variant="outline"
            >
              {t("Keep meeting")}
            </Button>
            <Button
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
              type="button"
              variant="destructive"
            >
              {remove.isPending && <LoaderCircle className="animate-spin" />}
              {t("Delete permanently")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setParticipantToDelete(undefined);
        }}
        open={Boolean(participantToDelete)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Remove this participant?")}</DialogTitle>
            <DialogDescription>
              {t("{name} and all of their availability will be permanently removed from this meeting.", {
                name: participantToDelete?.displayName ?? t("This participant"),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={removeParticipant.isPending}
              onClick={() => setParticipantToDelete(undefined)}
              type="button"
              variant="outline"
            >
              {t("Cancel")}
            </Button>
            <Button
              disabled={removeParticipant.isPending || !participantToDelete}
              onClick={() => {
                if (participantToDelete) {
                  removeParticipant.mutate(participantToDelete.id);
                }
              }}
              type="button"
              variant="destructive"
            >
              {removeParticipant.isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <UserMinus />
              )}
              {t("Remove participant")}
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
          label={t("Date range")}
          value={`${formatDate(data.startDate, { month: "short", day: "numeric", year: "numeric" })} – ${formatDate(data.endDate, { month: "short", day: "numeric", year: "numeric" })}`}
        />
        <InfoCard
          icon={<UsersRound />}
          label={t("Responses")}
          value={`${data.responseCount} / ${data.participantCount}`}
        />
        <InfoCard
          icon={<Link2 />}
          label={t("Schedule")}
          value={t(
            "{timezone} · {start}–{end} · {minutes}-minute slots · {duration} meeting",
            {
              timezone: data.timezone,
              start: data.workdayStart,
              end: data.workdayEnd,
              minutes: data.slotIntervalMinutes,
              duration: formatDuration(data.meetingDurationMinutes),
            },
          )}
        />
      </div>

      {data.finalized && <MeetingScheduledCard meeting={data} />}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.75fr)]">
        <div className="space-y-6">
          <div id="manual-time-grid">
            <DashboardSection
              icon={<Flame />}
              title={
                manualSelection
                  ? t("Choose your meeting time")
                  : t("Live availability heatmap")
              }
            >
              <AvailabilityGrid
                highlightedMatch={highlightedMatch}
                manualMeetingMode={manualSelection && !data.finalized}
                meeting={data}
                mode="organizer"
                onInspectParticipants={setHighlightedParticipantIds}
                onManualSelect={setSelectedMatch}
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
                selectedMatch={manualSelection ? selectedMatch : undefined}
              />
              {manualSelection && selectedMatch && (
                <FinalizeChoice
                  isPending={finalize.isPending}
                  match={selectedMatch}
                  onCancel={() => setSelectedMatch(undefined)}
                  onConfirm={() => finalize.mutate(selectedMatch)}
                  timezone={data.timezone}
                />
              )}
            </DashboardSection>
          </div>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6">
          <DashboardSection
            action={
              <Button
                aria-label={t("Refresh suggestions")}
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
            title={t("Top matches")}
          >
            <BestTimeSuggestions
              matches={data.bestTimes}
              onHighlight={(match) => {
                setHighlightedMatch(match);
                setHighlightedParticipantIds(match?.participantIds ?? []);
              }}
              participants={data.participants}
              onSelect={
                data.finalized
                  ? undefined
                  : (match) => {
                      setManualSelection(false);
                      setSelectedMatch(match);
                    }
              }
              timezone={data.timezone}
            />
            {!data.finalized && (
              <Button
                className="mt-4 w-full"
                onClick={() => {
                  const next = !manualSelection;
                  setManualSelection(next);
                  setSelectedMatch(undefined);
                  if (next) {
                    window.requestAnimationFrame(() =>
                      document
                        .getElementById("manual-time-grid")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        }),
                    );
                  }
                }}
                type="button"
                variant={manualSelection ? "secondary" : "outline"}
              >
                <Plus className={manualSelection ? "rotate-45" : ""} />
                {manualSelection ? t("Cancel") : t("Create your own")}
              </Button>
            )}
            {selectedMatch && !manualSelection && (
              <FinalizeChoice
                isPending={finalize.isPending}
                match={selectedMatch}
                onCancel={() => setSelectedMatch(undefined)}
                onConfirm={() => finalize.mutate(selectedMatch)}
                timezone={data.timezone}
              />
            )}
          </DashboardSection>

          <DashboardSection icon={<UsersRound />} title={t("Participants")}>
            {data.participants.length === 0 ? (
              <StatePanel
                className="min-h-36"
                description={t(
                  "Add your availability or share the invite link to collect the first response.",
                )}
                icon={<UsersRound />}
                title={t("No responses yet")}
              />
            ) : (
              <ul className="divide-y divide-white/10">
                {data.participants.map((participant) => (
                  <li
                    className={`flex items-start justify-between gap-3 rounded-xl border border-transparent px-2 py-3 transition-colors duration-150 ${
                      highlightedParticipantIds.includes(participant.id)
                        ? "border-emerald-600/70 bg-emerald-950/35"
                        : ""
                    }`}
                    data-highlighted={
                      highlightedParticipantIds.includes(participant.id)
                        ? "true"
                        : "false"
                    }
                    data-participant-id={participant.id}
                    key={participant.id}
                  >
                    <div className="min-w-0">
                      <p className="text-sm">
                        {participant.isOrganizer
                          ? t("You (organizer)")
                          : participant.displayName}
                      </p>
                      {participant.comment && (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          “{participant.comment}”
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={
                          participant.responded
                            ? "text-xs text-primary"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {participant.responded ? t("Responded") : t("Not answered")}
                      </span>
                      {!participant.isOrganizer && (
                        <Button
                          aria-label={t("Remove {name}", {
                            name: participant.displayName,
                          })}
                          disabled={removeParticipant.isPending}
                          onClick={() =>
                            setParticipantToDelete({
                              id: participant.id,
                              displayName: participant.displayName,
                            })
                          }
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <UserMinus />
                        </Button>
                      )}
                    </div>
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

function GridLoadingState({ label }: { label: string }) {
  const { t } = useI18n();
  return (
    <div
      className="grid min-h-72 place-items-center rounded-lg border border-white/10 bg-black/10"
      role="status"
    >
      <div className="text-center text-sm text-muted-foreground">
        <LoaderCircle className="mx-auto mb-2 size-5 animate-spin text-primary" />
        {t("Loading {label}…", { label: t(label) })}
      </div>
    </div>
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
  const { formatDate, t } = useI18n();
  return (
    <div className="mt-4 rounded-2xl border border-primary/35 bg-primary/[0.09] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
        {t("Final confirmation")}
      </p>
      <p className="mt-2 text-sm font-medium">
        {formatDate(match.datetimeStart, {
          weekday: "long",
          month: "short",
          day: "numeric",
          timeZone: timezone,
        })}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatDate(match.datetimeStart, {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
          timeZone: timezone,
        })}
        –
        {formatDate(match.datetimeEnd, {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
          timeZone: timezone,
        })}{" "}
        · {t("{percentage}% available", { percentage: match.percentage })}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {t(
          "Finalizing locks every response and shows this confirmed time to all participants.",
        )}
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={onCancel} type="button" variant="ghost">
          {t("Cancel")}
        </Button>
        <Button disabled={isPending} onClick={onConfirm} type="button">
          {isPending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <CalendarCheck2 />
          )}
          {t("Finalize meeting")}
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
  const { t } = useI18n();
  if (!meeting.finalized && !meeting.locked) return null;
  return (
    <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
      {meeting.finalized ? t("Finalized") : t("Responses locked")}
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
  const { t } = useI18n();
  const label = {
    connecting: t("Connecting"),
    live: t("Live"),
    offline: t("Reconnecting"),
  }[status];
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs text-muted-foreground">
      <span
        className={`size-1.5 rounded-full ${
          status === "live"
            ? "bg-primary shadow-[0_0_10px_oklch(0.82_0.18_245)]"
            : "animate-pulse bg-white/35"
        }`}
      />
      {label}
    </span>
  );
}
