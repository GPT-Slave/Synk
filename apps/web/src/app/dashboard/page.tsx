"use client";

import type {
  MeetingStatus,
  OrganizerMeetingDto,
} from "@meet-planner/shared-types";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Clock3, UsersRound } from "lucide-react";
import Link from "next/link";
import { OrganizerShell } from "@/components/organizer-shell";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { listMeetings } from "@/lib/meeting-api";

const groups: Array<{ status: MeetingStatus; title: string }> = [
  { status: "upcoming", title: "Upcoming" },
  { status: "finalized", title: "Finalized" },
  { status: "past", title: "Past" },
];

export default function DashboardPage() {
  return (
    <OrganizerShell>
      <DashboardContent />
    </OrganizerShell>
  );
}

function DashboardContent() {
  const { data: session } = useSession();
  const meetings = useQuery({
    queryKey: ["meetings"],
    queryFn: listMeetings,
  });

  return (
    <section className="mx-auto max-w-6xl py-12 sm:py-16">
      <p className="text-sm text-muted-foreground">
        Signed in as {session?.user.email}
      </p>
      <div className="mt-3 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">
            Your meetings
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Create a poll, share its private invitation link, and watch
            responses arrive.
          </p>
        </div>
        <Button
          className="h-10 px-4"
          render={<Link href="/dashboard/meetings/new" />}
        >
          <CalendarPlus /> Create meeting
        </Button>
      </div>

      {meetings.isPending && <MeetingListSkeleton />}
      {meetings.isError && (
        <p className="mt-12 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-blue-100">
          Could not load your meetings. Make sure the API and database are
          running.
        </p>
      )}
      {meetings.data?.length === 0 && (
        <div className="mt-12 border-y border-white/10 py-14 text-center">
          <CalendarPlus className="mx-auto size-7 text-primary" />
          <h2 className="mt-4 text-lg font-medium">No meetings yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your first availability poll takes less than a minute to create.
          </p>
        </div>
      )}

      <div className="mt-12 space-y-12">
        {groups.map((group) => {
          const items = meetings.data?.filter(
            (meeting) => meeting.status === group.status,
          );
          if (!items?.length) return null;
          return (
            <section key={group.status}>
              <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {group.title}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function MeetingCard({ meeting }: { meeting: OrganizerMeetingDto }) {
  return (
    <Link
      className="group rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/[0.035]"
      href={`/dashboard/meetings/${meeting.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-medium tracking-tight group-hover:text-primary">
          {meeting.title}
        </h3>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          {meeting.status}
        </span>
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Clock3 className="size-4" /> {formatDate(meeting.startDate)} –{" "}
        {formatDate(meeting.endDate)}
      </p>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <UsersRound className="size-4" /> {meeting.responseCount} of{" "}
        {meeting.participantCount} responded
      </p>
    </Link>
  );
}

function MeetingListSkeleton() {
  return (
    <div className="mt-12 grid gap-3 md:grid-cols-2" role="status">
      {[0, 1].map((item) => (
        <div
          className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]"
          key={item}
        />
      ))}
      <span className="sr-only">Loading meetings…</span>
    </div>
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
