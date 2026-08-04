"use client";

import type { MeetingDto } from "@meet-planner/shared-types";
import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionPanel } from "@/components/ui/motion-panel";
import { useI18n } from "@/lib/i18n";

export function MeetingScheduledCard({
  meeting,
  compact = false,
}: {
  meeting: Pick<MeetingDto, "finalSlot" | "timezone" | "title">;
  compact?: boolean;
}) {
  const { formatDate: localizeDate, t } = useI18n();
  const start = meeting.finalSlot?.datetimeStart;
  const end = meeting.finalSlot?.datetimeEnd;

  return (
    <MotionPanel
      className={`relative overflow-hidden rounded-3xl border border-primary/30 bg-primary/[0.09] ${compact ? "p-5 sm:p-6" : "mt-10 p-6 sm:p-8"}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,oklch(0.82_0.18_245_/_0.2),transparent_42%)]" />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary/90">
          <CheckCircle2 className="size-3.5 text-primary" /> {t("Confirmed")}
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("Meeting scheduled")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("{title} now has a confirmed time.", { title: meeting.title })}
        </p>

        {start && end ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarCheck2 className="size-4 text-primary" /> {t("Date")}
                </p>
                <p className="mt-2 font-medium">
                  {localizeDate(start, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: meeting.timezone,
                  })}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="size-4 text-primary" /> {t("Time")}
                </p>
                <p className="mt-2 font-medium">
                  {localizeDate(start, {
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                    timeZone: meeting.timezone,
                  })}
                  –
                  {localizeDate(end, {
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                    timeZone: meeting.timezone,
                  })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {meeting.timezone}
                </p>
              </div>
            </div>
            <Button
              className="mt-5"
              render={
                <a
                  href="https://meet.google.com/"
                  rel="noopener noreferrer"
                  target="_blank"
                />
              }
            >
              {t("Open Google Meet")} <ExternalLink />
            </Button>
          </>
        ) : (
          <p className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-muted-foreground">
            {t("The organizer is confirming the exact time.")}
          </p>
        )}
      </div>
    </MotionPanel>
  );
}
