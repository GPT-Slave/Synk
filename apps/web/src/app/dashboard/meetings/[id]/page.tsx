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
import { Button } from "@/components/ui/button";
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
          value={`${data.timezone} · ${data.workdayStart}–${data.workdayEnd}`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
        <DashboardSection title="Participants" icon={<UsersRound />}>
          {data.participants.length === 0 ? (
            <EmptyText>
              Share the invite link to collect the first response.
            </EmptyText>
          ) : (
            <ul className="divide-y divide-white/10">
              {data.participants.map((participant) => (
                <li
                  className="flex items-center justify-between py-3"
                  key={participant.id}
                >
                  <span className="text-sm">{participant.displayName}</span>
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

        <div className="space-y-6">
          <DashboardSection title="Availability heatmap" icon={<Flame />}>
            <EmptyText>
              The live overlap heatmap will appear here in the next phase.
            </EmptyText>
          </DashboardSection>
          <DashboardSection title="Best meeting times" icon={<Sparkles />}>
            <EmptyText>
              Ranked suggestions will use participant availability in the next
              phase.
            </EmptyText>
          </DashboardSection>
        </div>
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

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
