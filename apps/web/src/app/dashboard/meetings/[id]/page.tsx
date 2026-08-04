"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Copy,
  Flame,
  Link2,
  Pencil,
  Sparkles,
  Trash2,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { OrganizerShell } from "@/components/organizer-shell";
import { BestTimeSuggestions } from "@/components/meetings/best-time-suggestions";
import { HeatmapGrid } from "@/components/meetings/heatmap-grid";
import { Button } from "@/components/ui/button";
import { useMeetingRealtime } from "@/hooks/use-meeting-realtime";
import { deleteMeeting, getMeeting } from "@/lib/meeting-api";

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
  const realtimeStatus = useMeetingRealtime(id);
  const meeting = useQuery({
    queryKey: ["meetings", id],
    queryFn: () => getMeeting(id),
  });
  const remove = useMutation({
    mutationFn: () => deleteMeeting(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      router.replace("/dashboard");
    },
  });

  if (meeting.isPending) {
    return (
      <div className="mx-auto mt-16 h-80 max-w-6xl animate-pulse rounded-2xl bg-white/5" />
    );
  }
  if (meeting.isError) {
    return (
      <section className="mx-auto max-w-6xl py-16">
        <h1 className="text-2xl font-semibold">Meeting not found</h1>
        <p className="mt-2 text-muted-foreground">
          It may have been deleted, or it belongs to another organizer.
        </p>
      </section>
    );
  }

  const data = meeting.data;
  async function copyInviteLink() {
    const inviteUrl = `${window.location.origin}/meets/${data.slug}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function confirmDelete() {
    if (
      window.confirm(
        "Delete this meeting and every participant response? This cannot be undone.",
      )
    ) {
      remove.mutate();
    }
  }

  return (
    <section className="mx-auto max-w-6xl py-10 sm:py-14">
      <Link
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        href="/dashboard"
      >
        <ArrowLeft className="size-4" /> All meetings
      </Link>

      <div className="mt-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-semibold tracking-tight">
              {data.title}
            </h1>
            {data.finalized && (
              <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                Finalized
              </span>
            )}
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
            <Button
              render={<Link href={`/dashboard/meetings/${id}/edit`} />}
              variant="outline"
            >
              <Pencil /> Edit
            </Button>
          )}
          <Button onClick={copyInviteLink} type="button">
            {copied ? <Check /> : <Copy />}{" "}
            {copied ? "Copied" : "Copy invite link"}
          </Button>
          <Button
            aria-label="Delete meeting"
            disabled={remove.isPending}
            onClick={confirmDelete}
            size="icon"
            type="button"
            variant="destructive"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
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
          label="Timezone"
          value={`${data.timezone} · ${data.workdayStart}–${data.workdayEnd} · ${data.slotIntervalMinutes} min`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <DashboardSection title="Participants" icon={<UsersRound />}>
          {data.participants.length === 0 ? (
            <EmptyText>
              Share the invite link to collect the first response.
            </EmptyText>
          ) : (
            <ul className="divide-y divide-white/10">
              {data.participants.map((participant) => (
                <li
                  className="flex items-start justify-between gap-3 py-3"
                  key={participant.id}
                >
                  <div className="min-w-0">
                    <p className="text-sm">{participant.displayName}</p>
                    {participant.comment && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        “{participant.comment}”
                      </p>
                    )}
                  </div>
                  <span
                    className={
                      participant.responded
                        ? "text-xs text-primary"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {participant.responded ? "Responded" : "Not answered"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DashboardSection>

        <DashboardSection title="Best meeting times" icon={<Sparkles />}>
          <BestTimeSuggestions
            matches={data.bestTimes}
            timezone={data.timezone}
          />
        </DashboardSection>
      </div>

      <div className="mt-6">
        <DashboardSection title="Live availability heatmap" icon={<Flame />}>
          <HeatmapGrid meeting={data} />
        </DashboardSection>
      </div>
    </section>
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-primary">
        {icon} {label}
      </div>
      <p className="mt-3 text-sm font-medium">{value}</p>
    </div>
  );
}

function DashboardSection({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-medium [&_svg]:size-4 [&_svg]:text-primary">
        {icon} {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
  );
}

function LiveStatus({
  status,
}: {
  status: "connecting" | "live" | "offline";
}) {
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
            ? "bg-sky-400 shadow-[0_0_10px_oklch(0.75_0.15_235)]"
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
