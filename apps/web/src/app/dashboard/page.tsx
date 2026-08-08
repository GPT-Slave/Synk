"use client";

import type {
  MeetingStatus,
  OrganizerMeetingDto,
} from "@meet-planner/shared-types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CalendarPlus, Clock3, UsersRound } from "lucide-react";
import Link from "next/link";
import { OrganizerShell } from "@/components/organizer-shell";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { useSession } from "@/hooks/use-session";
import { listMeetings } from "@/lib/meeting-api";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
  const { data: session } = useSession();
  const meetings = useInfiniteQuery({
    queryKey: ["meetings"],
    queryFn: ({ pageParam }) => listMeetings(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor,
  });
  const items = meetings.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="synk-enter mx-auto max-w-6xl py-12 sm:py-16">
      <p className="text-sm text-muted-foreground">
        {t("Signed in as")} {session?.user.email}
      </p>
      <div className="mt-3 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">
            {t("Your meetings")}
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            {t(
              "Create a poll, share its private invitation link, and watch responses arrive.",
            )}
          </p>
        </div>
        <Button
          className="group h-10 px-4"
          render={<Link href="/dashboard/meetings/new" />}
        >
          <CalendarPlus className="transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6" />{" "}
          {t("Create meeting")}
        </Button>
      </div>

      {meetings.isPending && <MeetingListSkeleton />}
      {meetings.isError && (
        <StatePanel
          className="mt-12"
          description={t(
            "Check that the API and database are running, then try again.",
          )}
          kind="error"
          title={t("Could not load your meetings")}
        />
      )}
      {!meetings.isPending && !meetings.isError && items.length === 0 && (
        <StatePanel
          action={
            <Button render={<Link href="/dashboard/meetings/new" />}>
              <CalendarPlus /> {t("Create your first meeting")}
            </Button>
          }
          className="mt-12"
          description={t(
            "Your first availability poll takes less than a minute to create.",
          )}
          icon={<CalendarPlus />}
          title={t("No meetings yet")}
        />
      )}

      <div className="mt-12 space-y-12">
        {groups.map((group) => {
          const groupItems = items.filter(
            (meeting) => meeting.status === group.status,
          );
          if (!groupItems.length) return null;
          return (
            <section key={group.status}>
              <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {t(group.title)}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {groupItems.map((meeting, index) => (
                  <MeetingCard
                    index={index}
                    key={meeting.id}
                    meeting={meeting}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {meetings.hasNextPage && (
        <div className="mt-10 flex justify-center">
          <Button
            disabled={meetings.isFetchingNextPage}
            onClick={() => void meetings.fetchNextPage()}
            variant="outline"
          >
            {meetings.isFetchingNextPage
              ? t("Loading…")
              : t("Load more meetings")}
          </Button>
        </div>
      )}
    </section>
  );
}

function MeetingCard({
  index,
  meeting,
}: {
  index: number;
  meeting: OrganizerMeetingDto;
}) {
  const { formatDate, t } = useI18n();
  const responseProgress = meeting.participantCount
    ? Math.min(
        100,
        Math.round((meeting.responseCount / meeting.participantCount) * 100),
      )
    : 0;

  return (
    <Link
      className="synk-card-lift synk-enter synk-shine group block rounded-2xl border border-white/10 bg-white/[0.025] p-5 hover:border-primary/35 hover:bg-primary/[0.035]"
      href={`/dashboard/meetings/${meeting.id}`}
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <div className="relative z-10 flex items-start justify-between gap-4">
        <h3 className="font-medium tracking-tight transition-colors group-hover:text-primary">
          {meeting.title}
        </h3>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground transition-colors group-hover:border-primary/25 group-hover:text-foreground">
          {t(
            groups.find((group) => group.status === meeting.status)?.title ??
              meeting.status,
          )}
        </span>
      </div>
      <p className="relative z-10 mt-4 flex items-center gap-2 text-sm text-muted-foreground transition-colors group-hover:text-foreground/80">
        <Clock3 className="size-4 text-primary/75 transition-transform duration-200 group-hover:scale-110" />{" "}
        {formatDate(meeting.startDate, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}{" "}
        –{" "}
        {formatDate(meeting.endDate, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </p>
      <p className="relative z-10 mt-2 flex items-center gap-2 text-sm text-muted-foreground transition-colors group-hover:text-foreground/80">
        <UsersRound className="size-4 text-primary/75 transition-transform duration-200 group-hover:scale-110" />{" "}
        {t("{responses} of {participants} responded", {
          responses: meeting.responseCount,
          participants: meeting.participantCount,
        })}
      </p>
      <div
        aria-hidden="true"
        className="relative z-10 mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]"
      >
        <span
          className="block h-full rounded-full bg-primary/70 transition-[width] duration-500"
          style={{ width: `${responseProgress}%` }}
        />
      </div>
    </Link>
  );
}

function MeetingListSkeleton() {
  const { t } = useI18n();
  return (
    <div className="mt-12 grid gap-3 md:grid-cols-2" role="status">
      {[0, 1].map((item) => (
        <div
          className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]"
          key={item}
        />
      ))}
      <span className="sr-only">{t("Loading meetings…")}</span>
    </div>
  );
}
