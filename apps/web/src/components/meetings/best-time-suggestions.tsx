import type { BestMatchDto } from "@meet-planner/shared-types";
import { ArrowRight, Sparkles, UsersRound } from "lucide-react";

export function BestTimeSuggestions({
  matches,
  timezone,
}: {
  matches: BestMatchDto[];
  timezone: string;
}) {
  if (matches.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        Suggestions appear as soon as someone saves availability.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {matches.map((match, index) => (
        <li
          className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-black/10 p-4 transition duration-200 hover:border-primary/30 hover:bg-primary/[0.06]"
          key={match.datetimeStart}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-sm font-semibold text-primary">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
              <span>{formatDate(match.date)}</span>
              <ArrowRight className="size-3.5 text-primary" />
              <span>
                {match.timeLabel}–{formatTime(match.datetimeEnd, timezone)}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <UsersRound className="size-3.5" /> {match.availableCount} of{" "}
              {match.totalParticipants} available
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-primary">
              {match.percentage}%
            </p>
            {match.percentage === 100 && (
              <p className="flex items-center gap-1 text-[0.65rem] text-primary/75">
                <Sparkles className="size-3" /> Perfect
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).format(new Date(value));
}
