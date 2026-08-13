"use client";

import type {
  BestMatchDto,
  HeatmapParticipantDto,
} from "@meet-planner/shared-types";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarCheck2, Sparkles, UsersRound } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { StatePanel } from "@/components/ui/state-panel";
import { useI18n } from "@/lib/i18n";

const TOUCH_HOLD_MS = 450;

export function BestTimeSuggestions({
  matches,
  onHighlight,
  onSelect,
  participants = [],
  timezone,
}: {
  matches: BestMatchDto[];
  onHighlight?: (match?: BestMatchDto) => void;
  onSelect?: (match: BestMatchDto) => void;
  participants?: HeatmapParticipantDto[];
  timezone: string;
}) {
  const reduceMotion = useReducedMotion();
  const { formatDate, t } = useI18n();
  const [revealedMatch, setRevealedMatch] = useState<string>();
  const holdTimer = useRef<number | undefined>(undefined);
  const suppressClick = useRef(false);
  const participantById = useMemo(
    () => new Map(participants.map((participant) => [participant.id, participant])),
    [participants],
  );

  function highlight(match?: BestMatchDto) {
    onHighlight?.(match);
    window.dispatchEvent(
      new CustomEvent("synk:suggestion-highlight", { detail: match }),
    );
  }

  function reveal(match: BestMatchDto) {
    setRevealedMatch(match.datetimeStart);
    highlight(match);
  }

  function hide() {
    setRevealedMatch(undefined);
    highlight(undefined);
  }

  function clearHold() {
    if (holdTimer.current !== undefined) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = undefined;
    }
  }

  function namesFor(match: BestMatchDto) {
    if (match.participantIds.length) {
      return match.participantIds.map((id, index) => {
        const participant = participantById.get(id);
        if (participant?.isOrganizer) return t("You (organizer)");
        return participant?.displayName ?? match.participantNames[index] ?? id;
      });
    }
    return match.participantNames;
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
      {matches.map((match, index) => {
        const revealed = revealedMatch === match.datetimeStart;
        const names = namesFor(match);
        return (
          <li key={match.datetimeStart}>
            <motion.button
              aria-disabled={!onSelect || undefined}
              className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/10 p-3 text-start transition duration-200 hover:border-primary/40 hover:bg-primary/[0.07] focus-visible:outline-2 focus-visible:outline-primary sm:gap-4 sm:p-4"
              data-match-start={match.datetimeStart}
              onBlur={hide}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                onSelect?.(match);
              }}
              onFocus={() => reveal(match)}
              onMouseEnter={() => reveal(match)}
              onMouseLeave={hide}
              onPointerCancel={() => {
                clearHold();
                hide();
              }}
              onPointerDown={(event) => {
                if (event.pointerType !== "touch") return;
                clearHold();
                suppressClick.current = false;
                holdTimer.current = window.setTimeout(() => {
                  suppressClick.current = true;
                  reveal(match);
                }, TOUCH_HOLD_MS);
              }}
              onPointerUp={(event) => {
                if (event.pointerType !== "touch") return;
                clearHold();
                if (suppressClick.current) hide();
              }}
              type="button"
              whileHover={reduceMotion ? undefined : { y: -2 }}
              whileTap={reduceMotion ? undefined : { scale: 0.985 }}
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
                <AnimatePresence initial={false}>
                  {revealed && (
                    <motion.div
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      className="overflow-hidden"
                      data-match-participant-reveal="true"
                      exit={
                        reduceMotion
                          ? { opacity: 0 }
                          : { height: 0, opacity: 0, y: -4 }
                      }
                      initial={
                        reduceMotion
                          ? false
                          : { height: 0, opacity: 0, y: -4 }
                      }
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
                      }
                    >
                      <p
                        className="pt-2 text-xs leading-relaxed text-primary/80"
                        data-match-participant-names="true"
                      >
                        {names.length
                          ? names.join(", ")
                          : t("No participants available")}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
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
        );
      })}
    </ol>
  );
}
