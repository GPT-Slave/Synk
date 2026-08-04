import type { MeetingDto } from "@meet-planner/shared-types";
import { CalendarCheck2, CheckCircle2, Clock3 } from "lucide-react";
import { MotionPanel } from "@/components/ui/motion-panel";

export function MeetingScheduledCard({
  meeting,
  compact = false,
}: {
  meeting: Pick<MeetingDto, "finalSlot" | "timezone" | "title">;
  compact?: boolean;
}) {
  const start = meeting.finalSlot?.datetimeStart;
  const end = meeting.finalSlot?.datetimeEnd;

  return (
    <MotionPanel
      className={`relative overflow-hidden rounded-3xl border border-primary/30 bg-primary/[0.09] ${compact ? "p-5 sm:p-6" : "mt-10 p-6 sm:p-8"}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,oklch(0.86_0.24_145_/_0.2),transparent_42%)]" />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary/90">
          <CheckCircle2 className="size-3.5 text-primary" /> Confirmed
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
          Meeting scheduled
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {meeting.title} now has a confirmed time.
        </p>

        {start && end ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarCheck2 className="size-4 text-primary" /> Date
              </p>
              <p className="mt-2 font-medium">
                {formatDate(start, meeting.timezone)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="size-4 text-primary" /> Time
              </p>
              <p className="mt-2 font-medium">
                {formatTime(start, meeting.timezone)}–
                {formatTime(end, meeting.timezone)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {meeting.timezone}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-muted-foreground">
            The organizer is confirming the exact time.
          </p>
        )}
      </div>
    </MotionPanel>
  );
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
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
