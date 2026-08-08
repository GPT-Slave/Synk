"use client";

import type { BestMatchDto } from "@meet-planner/shared-types";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarCheck2, Sparkles, UsersRound } from "lucide-react";
import { StatePanel } from "@/components/ui/state-panel";
import { useI18n } from "@/lib/i18n";

export function BestTimeSuggestions({
  matches,
  onHighlight,
  onSelect,
  timezone,
}: {
  matches: BestMatchDto[];
  onHighlight?: (match?: BestMatchDto) => void;
  onSelect?: (match: BestMatchDto) => void;
  timezone: string;
}) {
  const reduceMotion = useReducedMotion();
  const { formatDate, t } = useI18n();
  function highlight(match?: BestMatchDto) {
    onHighlight?.(match);
    window.dispatchEvent(
      new CustomEvent("synk:suggestion-highlight", { detail: match }),
    );
  }
  if (matches.length === 0) {
    return (
      <StatePanel
        className="min-h-36"
        description={t("Suggestions appear as soon as someone saves availability.")}
        icon={<Sparkles />}
        title={t("No matches yet")}
      />
    );
  }

  return (
    <ol className="space-y-3">
      {matches.map((match, index) => (
        <li key={match.datetimeStart}>
          <motion.button
            className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/10 p-3 text-start transition duration-200 hover:border-primary/40 hover:bg-primary/[0.07] focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:hover:border-white/10 disabled:hover:bg-black/10 sm:gap-4 sm:p-4"
            disabled={!onSelect}
            onBlur={() => highlight(undefined)}
            onClick={() => onSelect?.(match)}
            onFocus={() => highlight(match)}
            onMouseEnter={() => highlight(match)}
            onMouseLeave={() => highlight(undefined)}
            type="button"
            whileHover={reduceMotion || !onSelect ? undefined : { y: -2 }}
            whileTap={reduceMotion || !onSelect ? undefined : { scale: 0.985 }}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-sm font-semibold text-primary">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                <span>
                  {formatDate(match.date, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <ArrowRight className="size-3.5 text-primary" />
                <span>
                  {match.timeLabel}–
                  {formatDate(match.datetimeEnd, {
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                    timeZone: timezone,
                  })}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <UsersRound className="size-3.5" />{" "}
                {t("{available} of {total} available", {
                  available: match.availableCount,
                  total: match.totalParticipants,
                })}
              </p>
            </div>
            <div className="shrink-0 text-end">
              <p className="text-lg font-semibold text-primary">
                {match.percentage}%
              </p>
              {match.percentage === 100 && (
                <p className="flex items-center gap-1 text-[0.65rem] text-primary/75">
                  <Sparkles className="size-3" /> {t("Perfect")}
                </p>
              )}
              {onSelect && (
                <p className="mt-1 flex items-center justify-end gap-1 text-[0.65rem] text-primary/65 transition group-hover:text-primary">
                  <CalendarCheck2 className="size-3" /> {t("Select")}
                </p>
              )}
            </div>
          </motion.button>
        </li>
      ))}
    </ol>
  );
}
