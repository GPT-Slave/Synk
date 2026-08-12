from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"Expected block not found in {path}: {old[:120]!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


write(
    "apps/web/src/components/meetings/interactive-availability-heatmap.tsx",
    r'''"use client";

import type {
  BestMatchDto,
  HeatmapCellDto,
  HeatmapParticipantDto,
  ParticipantDto,
  PublicMeetingDto,
} from "@meet-planner/shared-types";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  MoveHorizontal,
  PenLine,
} from "lucide-react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useI18n } from "@/lib/i18n";

const MOBILE_QUERY = "(max-width: 639px)";
const HOLD_TO_INSPECT_MS = 450;
const TOUCH_DRAG_THRESHOLD = 10;
const DAY_SWIPE_THRESHOLD = 42;

type MobileInteractionMode = "edit" | "view";

type MeetingForHeatmap = Pick<
  PublicMeetingDto,
  | "dates"
  | "heatmap"
  | "meetingDurationMinutes"
  | "slotIntervalMinutes"
  | "slots"
>;

interface TooltipState {
  cell: HeatmapCellDto;
  x: number;
  y: number;
}

interface TouchGesture {
  pointerId: number;
  startX: number;
  startY: number;
  cell: HeatmapCellDto;
  dragging: boolean;
  longPressTriggered: boolean;
  holdTimer?: number;
}

interface InteractiveAvailabilityHeatmapProps {
  currentParticipant: ParticipantDto;
  editable: boolean;
  highlightedMatch?: BestMatchDto;
  manualMeetingMode?: boolean;
  meeting: MeetingForHeatmap;
  onInspectParticipants?: (participantIds: string[]) => void;
  onManualSelect?: (match: BestMatchDto) => void;
  onToggleSlot: (slotStart: string) => void;
  participants: HeatmapParticipantDto[];
  selected: Set<string>;
  selectedMatch?: BestMatchDto;
  showParticipantRoster?: boolean;
}

export function InteractiveAvailabilityHeatmap({
  currentParticipant,
  editable,
  highlightedMatch,
  manualMeetingMode = false,
  meeting,
  onInspectParticipants,
  onManualSelect,
  onToggleSlot,
  participants,
  selected,
  selectedMatch,
  showParticipantRoster = false,
}: InteractiveAvailabilityHeatmapProps) {
  const reduceMotion = useReducedMotion();
  const { formatDate, t } = useI18n();
  const isMobile = useMobileLayout();
  const [mobileMode, setMobileMode] = useState<MobileInteractionMode>("edit");
  const [activeDateIndex, setActiveDateIndex] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState>();
  const [inspectedParticipantIds, setInspectedParticipantIds] = useState<string[]>([]);
  const dragging = useRef(false);
  const touchedSlot = useRef<string>();
  const touchGesture = useRef<TouchGesture>();

  const effectiveParticipants = useMemo(() => {
    const existing = participants.some(
      (participant) => participant.id === currentParticipant.id,
    );
    if (existing) return participants;
    return [
      ...participants,
      {
        id: currentParticipant.id,
        displayName: currentParticipant.displayName,
        ...(currentParticipant.isOrganizer ? { isOrganizer: true } : {}),
      },
    ];
  }, [currentParticipant, participants]);

  const participantLabelById = useMemo(() => {
    const labels = new Map<string, string>();
    for (const participant of effectiveParticipants) {
      labels.set(
        participant.id,
        participant.isOrganizer
          ? participant.id === currentParticipant.id
            ? t("You (organizer)")
            : t("Organizer")
          : participant.displayName,
      );
    }
    for (const cell of meeting.heatmap) {
      cell.participantIds.forEach((id, index) => {
        if (!labels.has(id) && cell.participantNames[index]) {
          labels.set(id, cell.participantNames[index]);
        }
      });
    }
    return labels;
  }, [currentParticipant.id, effectiveParticipants, meeting.heatmap, t]);

  const heatmap = useMemo(
    () =>
      optimisticHeatmap(
        meeting.heatmap,
        selected,
        currentParticipant.id,
        participantLabelById,
        effectiveParticipants.length,
      ),
    [
      currentParticipant.id,
      effectiveParticipants.length,
      meeting.heatmap,
      participantLabelById,
      selected,
    ],
  );

  const hours = useMemo(
    () =>
      Array.from(
        new Set(heatmap.map((cell) => `${cell.timeLabel.slice(0, 2)}:00`)),
      ),
    [heatmap],
  );
  const cellByGridPosition = useMemo(
    () =>
      new Map(heatmap.map((cell) => [`${cell.date}:${cell.timeLabel}`, cell])),
    [heatmap],
  );

  useEffect(() => {
    setActiveDateIndex((current) =>
      Math.max(0, Math.min(current, meeting.dates.length - 1)),
    );
  }, [meeting.dates.length]);

  const visibleDates = isMobile
    ? meeting.dates.slice(activeDateIndex, activeDateIndex + 1)
    : meeting.dates;
  const canEditAvailability =
    editable && !manualMeetingMode && (!isMobile || mobileMode === "edit");

  const clearHoldTimer = useCallback(() => {
    const gesture = touchGesture.current;
    if (gesture?.holdTimer !== undefined) {
      window.clearTimeout(gesture.holdTimer);
      gesture.holdTimer = undefined;
    }
  }, []);

  const inspect = useCallback(
    (cell: HeatmapCellDto, x: number, y: number) => {
      const clampedX =
        typeof window === "undefined"
          ? x
          : Math.max(116, Math.min(window.innerWidth - 116, x));
      setTooltip({ cell, x: clampedX, y });
      setInspectedParticipantIds(cell.participantIds);
      onInspectParticipants?.(cell.participantIds);
    },
    [onInspectParticipants],
  );

  const clearInspection = useCallback(() => {
    setTooltip(undefined);
    setInspectedParticipantIds([]);
    onInspectParticipants?.([]);
  }, [onInspectParticipants]);

  const applySlot = useCallback(
    (slotStart: string) => {
      if (!dragging.current || touchedSlot.current === slotStart) return;
      touchedSlot.current = slotStart;
      onToggleSlot(slotStart);
    },
    [onToggleSlot],
  );

  const chooseManualTime = useCallback(
    (cell: HeatmapCellDto) => {
      if (!manualMeetingMode || !onManualSelect) return;
      const match = manualMatchForCell(
        heatmap,
        meeting.meetingDurationMinutes,
        meeting.slotIntervalMinutes,
        cell.datetimeStart,
      );
      if (match) onManualSelect(match);
    },
    [
      heatmap,
      manualMeetingMode,
      meeting.meetingDurationMinutes,
      meeting.slotIntervalMinutes,
      onManualSelect,
    ],
  );

  useEffect(() => {
    function finishPointer(event: globalThis.PointerEvent) {
      const touch = touchGesture.current;
      if (touch && touch.pointerId === event.pointerId) {
        clearHoldTimer();
        const distance = Math.hypot(
          event.clientX - touch.startX,
          event.clientY - touch.startY,
        );
        if (!touch.longPressTriggered && !touch.dragging && distance < 8) {
          if (manualMeetingMode) {
            chooseManualTime(touch.cell);
          } else if (!editable || mobileMode === "view") {
            const element = document.querySelector<HTMLElement>(
              `[data-slot-start="${CSS.escape(touch.cell.datetimeStart)}"]`,
            );
            const box = element?.getBoundingClientRect();
            inspect(
              touch.cell,
              box ? box.left + box.width / 2 : event.clientX,
              box?.top ?? event.clientY,
            );
          } else {
            onToggleSlot(touch.cell.datetimeStart);
          }
        }
      }
      touchGesture.current = undefined;
      dragging.current = false;
      touchedSlot.current = undefined;
    }

    function cancelPointer() {
      clearHoldTimer();
      touchGesture.current = undefined;
      dragging.current = false;
      touchedSlot.current = undefined;
    }

    window.addEventListener("pointerup", finishPointer);
    window.addEventListener("pointercancel", cancelPointer);
    return () => {
      clearHoldTimer();
      window.removeEventListener("pointerup", finishPointer);
      window.removeEventListener("pointercancel", cancelPointer);
    };
  }, [
    chooseManualTime,
    clearHoldTimer,
    editable,
    inspect,
    manualMeetingMode,
    mobileMode,
    onToggleSlot,
  ]);

  function startPointer(
    event: ReactPointerEvent<HTMLButtonElement>,
    cell: HeatmapCellDto,
  ) {
    if (event.pointerType === "touch") {
      clearHoldTimer();
      const gesture: TouchGesture = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        cell,
        dragging: false,
        longPressTriggered: false,
      };
      gesture.holdTimer = window.setTimeout(() => {
        const current = touchGesture.current;
        if (!current || current.pointerId !== event.pointerId || current.dragging)
          return;
        current.longPressTriggered = true;
        const box = event.currentTarget.getBoundingClientRect();
        inspect(cell, box.left + box.width / 2, box.top);
      }, HOLD_TO_INSPECT_MS);
      touchGesture.current = gesture;
      return;
    }

    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if (manualMeetingMode) {
      event.preventDefault();
      chooseManualTime(cell);
      return;
    }
    if (!canEditAvailability) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
    touchedSlot.current = undefined;
    applySlot(cell.datetimeStart);
  }

  function continuePointer(event: ReactPointerEvent<HTMLDivElement>) {
    const touch = touchGesture.current;
    if (touch && touch.pointerId === event.pointerId) {
      const deltaX = event.clientX - touch.startX;
      const deltaY = event.clientY - touch.startY;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance >= 8) clearHoldTimer();
      if (
        canEditAvailability &&
        !touch.longPressTriggered &&
        !touch.dragging &&
        Math.abs(deltaX) > Math.abs(deltaY) &&
        Math.abs(deltaX) >= TOUCH_DRAG_THRESHOLD
      ) {
        touch.dragging = true;
        dragging.current = true;
        touchedSlot.current = undefined;
        applySlot(touch.cell.datetimeStart);
      }
      if (touch.dragging) event.preventDefault();
    }

    if (!dragging.current) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const slot = element?.closest<HTMLElement>("[data-slot-start]");
    if (slot?.dataset.slotStart) applySlot(slot.dataset.slotStart);
  }

  function keyboardActivate(cell: HeatmapCellDto) {
    if (manualMeetingMode) {
      chooseManualTime(cell);
      return;
    }
    if (canEditAvailability) {
      onToggleSlot(cell.datetimeStart);
      return;
    }
    const element = document.querySelector<HTMLElement>(
      `[data-slot-start="${CSS.escape(cell.datetimeStart)}"]`,
    );
    const box = element?.getBoundingClientRect();
    inspect(
      cell,
      box ? box.left + box.width / 2 : 160,
      box?.top ?? 160,
    );
  }

  return (
    <div data-unified-heatmap="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isMobile && !manualMeetingMode && (
            <div
              aria-label={t("View")}
              className="inline-flex rounded-xl border border-white/10 bg-black/15 p-1 sm:hidden"
              role="group"
            >
              <button
                aria-pressed={mobileMode === "edit"}
                className={`grid size-9 place-items-center rounded-lg transition ${
                  mobileMode === "edit"
                    ? "bg-primary/20 text-primary shadow-sm"
                    : "text-muted-foreground"
                }`}
                onClick={() => {
                  clearInspection();
                  setMobileMode("edit");
                }}
                title={t("Edit")}
                type="button"
              >
                <PenLine className="size-4" />
              </button>
              <button
                aria-pressed={mobileMode === "view"}
                className={`grid size-9 place-items-center rounded-lg transition ${
                  mobileMode === "view"
                    ? "bg-primary/20 text-primary shadow-sm"
                    : "text-muted-foreground"
                }`}
                onClick={() => {
                  clearInspection();
                  setMobileMode("view");
                }}
                title={t("View")}
                type="button"
              >
                <Eye className="size-4" />
              </button>
            </div>
          )}
        </div>
        <div
          aria-label={t("Heatmap legend")}
          className="flex items-center gap-2"
        >
          <span className="text-[0.65rem] text-muted-foreground">0%</span>
          <span className="heatmap-gradient h-2.5 w-24 rounded-full border border-white/10 sm:w-28" />
          <span className="text-[0.65rem] text-muted-foreground">100%</span>
        </div>
      </div>

      <div className="-mx-3 w-[calc(100%+1.5rem)] sm:mx-0 sm:w-full">
        <div
          className="grid w-full min-w-0 select-none"
          data-mobile-day-index={isMobile ? activeDateIndex : undefined}
          onPointerMove={continuePointer}
          style={{
            gridTemplateColumns: isMobile
              ? "2.75rem minmax(0, 1fr)"
              : `4.25rem repeat(${visibleDates.length}, minmax(0, 1fr))`,
          }}
        >
          <div />
          {visibleDates.map((date) => (
            <div
              className="min-w-0 truncate px-1 py-2.5 text-center text-xs font-medium leading-tight text-muted-foreground sm:py-3"
              data-date-header={date.date}
              key={date.date}
              title={date.label}
            >
              {formatDate(date.date, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </div>
          ))}

          {hours.map((hour, hourIndex) => (
            <AvailabilityHeatmapRow
              canEditAvailability={canEditAvailability}
              cellByGridPosition={cellByGridPosition}
              dates={visibleDates}
              formatDate={formatDate}
              highlightedMatch={highlightedMatch}
              hour={hour}
              hourIndex={hourIndex}
              hours={hours}
              isMobile={isMobile}
              key={hour}
              manualMeetingMode={manualMeetingMode}
              onBlur={clearInspection}
              onFocusCell={inspect}
              onHoverCell={inspect}
              onKeyboardActivate={keyboardActivate}
              onLeaveCell={clearInspection}
              onPointerDown={startPointer}
              reduceMotion={Boolean(reduceMotion)}
              selected={selected}
              selectedMatch={selectedMatch}
              t={t}
            />
          ))}
        </div>
      </div>

      {isMobile && meeting.dates.length > 1 && (
        <DaySwipeNavigator
          activeIndex={activeDateIndex}
          dates={meeting.dates}
          formatDate={formatDate}
          onChange={setActiveDateIndex}
          t={t}
        />
      )}

      {showParticipantRoster && (
        <div className="mt-5" data-participant-roster="true">
          <p className="text-xs font-medium text-muted-foreground">
            {t("Participants")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {effectiveParticipants.map((participant) => {
              const highlighted = inspectedParticipantIds.includes(participant.id);
              const label = participantLabelById.get(participant.id) ?? participant.displayName;
              return (
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs transition duration-150 ${
                    highlighted
                      ? "border-emerald-300/80 bg-emerald-400/15 text-emerald-100 shadow-[0_0_16px_rgba(52,211,153,0.28)]"
                      : "border-white/10 bg-white/[0.025] text-muted-foreground"
                  }`}
                  data-highlighted={highlighted ? "true" : "false"}
                  data-participant-id={participant.id}
                  key={participant.id}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 w-56 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl border border-white/15 bg-[#07111f]/98 p-3 text-xs shadow-2xl backdrop-blur-xl"
          data-heatmap-tooltip="true"
          role="tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="font-medium text-foreground">
            {t("{available} of {total} available", {
              available: tooltip.cell.availableCount,
              total: tooltip.cell.totalParticipants,
            })}
          </p>
          <p className="mt-1 text-muted-foreground">
            {tooltip.cell.participantIds.length
              ? tooltip.cell.participantIds
                  .map((id) => participantLabelById.get(id))
                  .filter(Boolean)
                  .join(", ")
              : t("No participants available")}
          </p>
        </div>
      )}
    </div>
  );
}

function AvailabilityHeatmapRow({
  canEditAvailability,
  cellByGridPosition,
  dates,
  formatDate,
  highlightedMatch,
  hour,
  hourIndex,
  hours,
  isMobile,
  manualMeetingMode,
  onBlur,
  onFocusCell,
  onHoverCell,
  onKeyboardActivate,
  onLeaveCell,
  onPointerDown,
  reduceMotion,
  selected,
  selectedMatch,
  t,
}: {
  canEditAvailability: boolean;
  cellByGridPosition: Map<string, HeatmapCellDto>;
  dates: PublicMeetingDto["dates"];
  formatDate: (
    value: Date | string,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  highlightedMatch?: BestMatchDto;
  hour: string;
  hourIndex: number;
  hours: string[];
  isMobile: boolean;
  manualMeetingMode: boolean;
  onBlur: () => void;
  onFocusCell: (cell: HeatmapCellDto, x: number, y: number) => void;
  onHoverCell: (cell: HeatmapCellDto, x: number, y: number) => void;
  onKeyboardActivate: (cell: HeatmapCellDto) => void;
  onLeaveCell: () => void;
  onPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    cell: HeatmapCellDto,
  ) => void;
  reduceMotion: boolean;
  selected: Set<string>;
  selectedMatch?: BestMatchDto;
  t: (message: string, variables?: Record<string, string | number>) => string;
}) {
  return (
    <>
      <div className="px-1 py-5 text-[0.68rem] text-muted-foreground sm:px-2 sm:text-xs">
        {hour}
      </div>
      {dates.map((date) => (
        <div className="min-h-14 p-0.5 sm:p-1" key={date.date}>
          <div className="grid size-full min-h-12 grid-cols-4 rounded-xl border border-white/10">
            {[0, 15, 30, 45].map((quarter, quarterIndex) => {
              const time = `${hour.slice(0, 3)}${String(quarter).padStart(2, "0")}`;
              const cell = cellByGridPosition.get(`${date.date}:${time}`);
              if (!cell) {
                return (
                  <span
                    aria-hidden="true"
                    className={`${
                      quarterIndex === 0 ? "rounded-l-[0.7rem]" : ""
                    } ${quarterIndex === 3 ? "rounded-r-[0.7rem]" : ""} bg-white/[0.01]`}
                    key={quarter}
                  />
                );
              }

              const active = selected.has(cell.datetimeStart);
              const leftCell =
                quarterIndex > 0
                  ? cellByGridPosition.get(
                      `${date.date}:${hour.slice(0, 3)}${String(quarter - 15).padStart(2, "0")}`,
                    )
                  : undefined;
              const rightCell =
                quarterIndex < 3
                  ? cellByGridPosition.get(
                      `${date.date}:${hour.slice(0, 3)}${String(quarter + 15).padStart(2, "0")}`,
                    )
                  : undefined;
              const selectedLeft = Boolean(
                active && leftCell && selected.has(leftCell.datetimeStart),
              );
              const selectedRight = Boolean(
                active && rightCell && selected.has(rightCell.datetimeStart),
              );
              const dateLabel = formatDate(date.date, {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              const highlighted = isCellInsideMatch(cell, highlightedMatch);
              const finalSelection = isCellInsideMatch(cell, selectedMatch);
              const quarterFill = ((quarterIndex + 1) / 4) * 100;
              const style = {
                ...heatmapColor(cell.percentage),
                "--synk-quarter-fill": `${quarterFill}%`,
              } as CSSProperties & { "--synk-quarter-fill": string };

              return (
                <motion.button
                  aria-label={t(
                    "{date} at {time}: {available} of {total} available{names}",
                    {
                      date: dateLabel,
                      time,
                      available: cell.availableCount,
                      total: cell.totalParticipants,
                      names: cell.participantNames.length
                        ? ` — ${cell.participantNames.join(", ")}`
                        : "",
                    },
                  )}
                  aria-pressed={active}
                  className={`relative grid min-h-12 place-items-center text-[0.58rem] font-semibold tabular-nums outline-none transition duration-150 focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-primary ${
                    quarterIndex === 0 ? "rounded-l-[0.7rem]" : ""
                  } ${quarterIndex === 3 ? "rounded-r-[0.7rem]" : ""} ${
                    manualMeetingMode
                      ? "cursor-crosshair"
                      : canEditAvailability
                        ? "cursor-pointer"
                        : "cursor-help"
                  } ${highlighted ? "z-[3] brightness-125 ring-1 ring-inset ring-sky-200/80" : ""} ${
                    finalSelection
                      ? "z-[4] ring-2 ring-inset ring-primary brightness-110"
                      : ""
                  }`}
                  data-boundary-left={active && !selectedLeft ? "true" : "false"}
                  data-boundary-right={active && !selectedRight ? "true" : "false"}
                  data-selected={active ? "true" : "false"}
                  data-slot-start={cell.datetimeStart}
                  key={quarter}
                  onBlur={onBlur}
                  onClick={(event) => {
                    if (event.detail === 0) onKeyboardActivate(cell);
                  }}
                  onFocus={(event) => {
                    const box = event.currentTarget.getBoundingClientRect();
                    onFocusCell(cell, box.left + box.width / 2, box.top);
                  }}
                  onMouseEnter={(event) => {
                    if (event.buttons !== 0) return;
                    onHoverCell(cell, event.clientX, event.clientY);
                  }}
                  onMouseLeave={() => {
                    if (!isMobile) onLeaveCell();
                  }}
                  onMouseMove={(event) => {
                    if (event.buttons === 0)
                      onHoverCell(cell, event.clientX, event.clientY);
                  }}
                  onPointerDown={(event) => onPointerDown(event, cell)}
                  style={style}
                  title={`${time} · ${cell.availableCount}/${cell.totalParticipants}`}
                  type="button"
                  whileHover={reduceMotion || isMobile ? undefined : { scale: 1.018 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                >
                  <span className="relative z-10">
                    {cell.availableCount}/{cell.totalParticipants}
                  </span>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-1 top-1 size-2.5 rounded-full border border-current/55 opacity-70"
                    style={{
                      background: `conic-gradient(from -90deg, currentColor 0 ${quarterFill}%, transparent ${quarterFill}% 100%)`,
                    }}
                  />
                  {active && (
                    <FusedSelectionBoundary
                      hideLeft={selectedLeft}
                      hideRight={selectedRight}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function FusedSelectionBoundary({
  hideLeft,
  hideRight,
}: {
  hideLeft: boolean;
  hideRight: boolean;
}) {
  const glow =
    "pointer-events-none absolute z-20 bg-emerald-300 shadow-[0_0_10px_2px_rgba(52,211,153,0.78)]";
  return (
    <>
      <span className={`${glow} inset-x-0 top-0 h-[2px]`} />
      <span className={`${glow} inset-x-0 bottom-0 h-[2px]`} />
      {!hideLeft && <span className={`${glow} inset-y-0 left-0 w-[2px]`} />}
      {!hideRight && <span className={`${glow} inset-y-0 right-0 w-[2px]`} />}
    </>
  );
}

function DaySwipeNavigator({
  activeIndex,
  dates,
  formatDate,
  onChange,
  t,
}: {
  activeIndex: number;
  dates: PublicMeetingDto["dates"];
  formatDate: (
    value: Date | string,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  onChange: (index: number) => void;
  t: (message: string, variables?: Record<string, string | number>) => string;
}) {
  const gesture = useRef<{ pointerId: number; x: number }>();
  const previous = () => onChange(Math.max(0, activeIndex - 1));
  const next = () => onChange(Math.min(dates.length - 1, activeIndex + 1));
  const active = dates[activeIndex];
  return (
    <div
      aria-label={t("Swipe between days")}
      className="mt-3 flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/[0.055] p-2 sm:hidden"
      data-day-swipe="true"
    >
      <button
        aria-label={t("Previous day")}
        className="grid size-10 shrink-0 place-items-center rounded-xl text-primary transition disabled:opacity-25"
        disabled={activeIndex === 0}
        onClick={previous}
        type="button"
      >
        <ChevronLeft className="size-5" />
      </button>
      <div
        className="flex min-h-12 flex-1 touch-none select-none items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/10 px-3 text-center"
        onPointerCancel={() => {
          gesture.current = undefined;
        }}
        onPointerDown={(event) => {
          gesture.current = { pointerId: event.pointerId, x: event.clientX };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          const current = gesture.current;
          gesture.current = undefined;
          if (!current || current.pointerId !== event.pointerId) return;
          const delta = event.clientX - current.x;
          if (delta <= -DAY_SWIPE_THRESHOLD) next();
          if (delta >= DAY_SWIPE_THRESHOLD) previous();
        }}
      >
        <MoveHorizontal className="size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">
            {active
              ? formatDate(active.date, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
              : ""}
          </p>
          <div className="mt-1 flex justify-center gap-1">
            {dates.map((date, index) => (
              <span
                aria-hidden="true"
                className={`h-1 rounded-full transition-all ${
                  index === activeIndex ? "w-4 bg-primary" : "w-1 bg-white/20"
                }`}
                key={date.date}
              />
            ))}
          </div>
        </div>
      </div>
      <button
        aria-label={t("Next day")}
        className="grid size-10 shrink-0 place-items-center rounded-xl text-primary transition disabled:opacity-25"
        disabled={activeIndex === dates.length - 1}
        onClick={next}
        type="button"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}

function optimisticHeatmap(
  heatmap: HeatmapCellDto[],
  selected: Set<string>,
  selfId: string,
  labelById: Map<string, string>,
  participantCount: number,
): HeatmapCellDto[] {
  const totalParticipants = Math.max(
    participantCount,
    ...heatmap.map((cell) => cell.totalParticipants),
  );
  return heatmap.map((cell) => {
    const participantIds = cell.participantIds.filter((id) => id !== selfId);
    if (selected.has(cell.datetimeStart)) participantIds.push(selfId);
    const uniqueIds = Array.from(new Set(participantIds));
    const participantNames = uniqueIds
      .map((id) => labelById.get(id))
      .filter((name): name is string => Boolean(name));
    const availableCount = uniqueIds.length;
    return {
      ...cell,
      participantIds: uniqueIds,
      participantNames,
      availableCount,
      totalParticipants,
      percentage: totalParticipants
        ? Math.round((availableCount / totalParticipants) * 100)
        : 0,
    };
  });
}

function manualMatchForCell(
  cells: HeatmapCellDto[],
  meetingDurationMinutes: number,
  slotIntervalMinutes: number,
  datetimeStart: string,
): BestMatchDto | undefined {
  const startIndex = cells.findIndex((cell) => cell.datetimeStart === datetimeStart);
  const cellsPerMeeting = meetingDurationMinutes / slotIntervalMinutes;
  if (startIndex < 0 || !Number.isInteger(cellsPerMeeting)) return undefined;
  const window = cells.slice(startIndex, startIndex + cellsPerMeeting);
  const first = window[0];
  if (
    !first ||
    window.length !== cellsPerMeeting ||
    window.some((cell) => cell.date !== first.date) ||
    window.some(
      (cell, index) =>
        index > 0 && window[index - 1].datetimeEnd !== cell.datetimeStart,
    )
  )
    return undefined;

  const participantIds = first.participantIds.filter((id) =>
    window.every((cell) => cell.participantIds.includes(id)),
  );
  const participantNames = participantIds
    .map((id) => {
      const index = first.participantIds.indexOf(id);
      return first.participantNames[index];
    })
    .filter((name): name is string => Boolean(name));
  const availableCount = participantIds.length;
  const totalParticipants = first.totalParticipants;
  return {
    datetimeStart: first.datetimeStart,
    datetimeEnd: window.at(-1)!.datetimeEnd,
    date: first.date,
    timeLabel: first.timeLabel,
    availableCount,
    totalParticipants,
    percentage: totalParticipants
      ? Math.round((availableCount / totalParticipants) * 100)
      : 0,
    participantIds,
    participantNames,
  };
}

function isCellInsideMatch(
  cell: HeatmapCellDto,
  match?: BestMatchDto,
): boolean {
  return Boolean(
    match &&
      cell.datetimeStart >= match.datetimeStart &&
      cell.datetimeStart < match.datetimeEnd,
  );
}

function heatmapColor(percentage: number): CSSProperties {
  const normalized = Math.max(0, Math.min(100, percentage)) / 100;
  const lightness = 0.17 + normalized * 0.49;
  const chroma = 0.025 + normalized * 0.155;
  const alpha = 0.65 + normalized * 0.35;
  return {
    backgroundColor: `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} 245 / ${alpha.toFixed(3)})`,
    borderColor: `oklch(0.82 0.18 245 / ${(0.12 + normalized * 0.58).toFixed(3)})`,
    boxShadow: `inset 0 0 ${Math.round(8 + normalized * 18)}px oklch(0.82 0.18 245 / ${(normalized * 0.24).toFixed(3)})`,
    color:
      normalized >= 0.48
        ? "oklch(0.985 0.01 245)"
        : "oklch(0.78 0.035 245)",
  };
}

function useMobileLayout() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return mobile;
}
''',
)

write(
    "apps/web/src/components/meetings/availability-grid.tsx",
    r'''"use client";

import type {
  AvailabilitySlotDto,
  BestMatchDto,
  ParticipantSessionDto,
  PublicMeetingDto,
} from "@meet-planner/shared-types";
import { useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  LoaderCircle,
  MessageSquareText,
  Save,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { InteractiveAvailabilityHeatmap } from "@/components/meetings/interactive-availability-heatmap";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatePanel } from "@/components/ui/state-panel";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/auth-api";
import { useI18n } from "@/lib/i18n";
import { saveAvailability } from "@/lib/meeting-api";

interface AvailabilityGridProps {
  meeting: PublicMeetingDto;
  participantSession: ParticipantSessionDto;
  sessionToken?: string;
  token?: string;
  mode?: "organizer" | "participant";
  onSave?: (response: AvailabilityResponse) => Promise<unknown>;
  onSaved?: () => void | Promise<void>;
  saveScope?: string;
  manualMeetingMode?: boolean;
  onManualSelect?: (match: BestMatchDto) => void;
  selectedMatch?: BestMatchDto;
  highlightedMatch?: BestMatchDto;
  onInspectParticipants?: (participantIds: string[]) => void;
}

export interface AvailabilityResponse {
  slots: AvailabilitySlotDto[];
  comment?: string;
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_IDLE_MS = 1_200;
const AUTOSAVE_MIN_INTERVAL_MS = 5_000;
const AUTOSAVE_ERROR_BACKOFF_MS = 10_000;

export function AvailabilityGrid({
  meeting,
  participantSession,
  sessionToken,
  token,
  mode = "participant",
  onSave,
  onSaved,
  saveScope,
  manualMeetingMode = false,
  onManualSelect,
  selectedMatch,
  highlightedMatch,
  onInspectParticipants,
}: AvailabilityGridProps) {
  const commentId = useId();
  const toast = useToast();
  const { t } = useI18n();
  const [selected, setSelected] = useState(
    () =>
      new Set(
        participantSession.availabilities.map((slot) => slot.datetimeStart),
      ),
  );
  const [comment, setComment] = useState(participantSession.comment ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showGuidance, setShowGuidance] = useState(mode === "participant");
  const response = useMemo<AvailabilityResponse>(
    () => ({
      slots: meeting.slots
        .filter((slot) => selected.has(slot.datetimeStart))
        .map((slot) => ({
          datetimeStart: slot.datetimeStart,
          datetimeEnd: slot.datetimeEnd,
        })),
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    }),
    [comment, meeting.slots, selected],
  );
  const responseKey = useMemo(() => availabilityKey(response), [response]);
  const latestKey = useRef(responseKey);
  const lastSavedKey = useRef(responseKey);
  const lastSaveStartedAt = useRef(0);
  const autosaveBlockedUntil = useRef(0);
  const toggleSlot = useCallback((slotStart: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slotStart)) next.delete(slotStart);
      else next.add(slotStart);
      return next;
    });
  }, []);

  const mutation = useMutation({
    mutationFn: async (nextResponse: AvailabilityResponse) => {
      if (onSave) return onSave(nextResponse);
      if (!token || !sessionToken) {
        throw new Error("Availability session is missing.");
      }
      return saveAvailability(token, sessionToken, nextResponse);
    },
    scope: {
      id:
        saveScope ??
        `availability:${token}:${participantSession.participant.id}`,
    },
    onMutate: () => {
      lastSaveStartedAt.current = Date.now();
      setSaveState("saving");
    },
    onSuccess: async (_saved, variables) => {
      const savedKey = availabilityKey(variables);
      autosaveBlockedUntil.current = 0;
      lastSavedKey.current = savedKey;
      setSaveState(latestKey.current === savedKey ? "saved" : "dirty");
      await onSaved?.();
    },
    onError: (error) => {
      const retryAfter =
        error instanceof ApiError && error.status === 429
          ? (error.retryAfterMs ?? AUTOSAVE_ERROR_BACKOFF_MS)
          : AUTOSAVE_ERROR_BACKOFF_MS;
      autosaveBlockedUntil.current = Date.now() + retryAfter;
      setSaveState("error");
    },
  });
  const saveResponse = mutation.mutate;

  useEffect(() => {
    latestKey.current = responseKey;
  }, [responseKey]);

  useEffect(() => {
    if (!meeting.acceptingResponses || responseKey === lastSavedKey.current) {
      return;
    }
    setSaveState("dirty");
    if (mutation.isPending) return;

    const now = Date.now();
    const delay = Math.max(
      AUTOSAVE_IDLE_MS,
      AUTOSAVE_MIN_INTERVAL_MS - (now - lastSaveStartedAt.current),
      autosaveBlockedUntil.current - now,
    );
    const timeout = window.setTimeout(() => saveResponse(response), delay);
    return () => window.clearTimeout(timeout);
  }, [
    meeting.acceptingResponses,
    mutation.isPending,
    response,
    responseKey,
    saveResponse,
  ]);

  const error = mutation.error
    ? mutation.error instanceof ApiError
      ? mutation.error.message
      : t("Your availability could not be saved.")
    : undefined;

  if (meeting.dates.length === 0 || meeting.slots.length === 0) {
    return (
      <StatePanel
        className={mode === "participant" ? "mt-8" : undefined}
        description={t(
          "The organizer needs to add at least one valid day and time slot before availability can be selected.",
        )}
        title={t("No schedule slots yet")}
      />
    );
  }

  return (
    <section className={mode === "participant" ? "mt-8" : ""}>
      {mode === "participant" && (
        <ParticipantGuidanceDialog
          onOpenChange={setShowGuidance}
          open={showGuidance}
        />
      )}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">
            {mode === "organizer" ? t("Your availability") : t("Responding as")}
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            {mode === "organizer"
              ? t("You (organizer)")
              : participantSession.participant.displayName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t(
              "Tap or drag to mark the times that work for you. On phones, switch days with the navigator below.",
            )}
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-primary/65">
            <ClockBadge />{" "}
            {t(
              "Times are fixed to {timezone} (meeting timezone) · {minutes}-minute slots",
              {
                timezone: meeting.timezone,
                minutes: meeting.slotIntervalMinutes,
              },
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SaveIndicator state={saveState} />
          <Button
            disabled={!meeting.acceptingResponses || mutation.isPending}
            onClick={() =>
              saveResponse(response, {
                onSuccess: () =>
                  toast({
                    title: t("Availability saved"),
                    description: t("Your latest times and note are safely stored."),
                    variant: "success",
                  }),
              })
            }
            type="button"
          >
            {saveState === "saving" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Save />
            )}
            {t("Save now")}
          </Button>
        </div>
      </div>

      {error && (
        <p
          className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="mt-6">
        <InteractiveAvailabilityHeatmap
          currentParticipant={participantSession.participant}
          editable={meeting.acceptingResponses}
          highlightedMatch={highlightedMatch}
          manualMeetingMode={manualMeetingMode}
          meeting={meeting}
          onInspectParticipants={onInspectParticipants}
          onManualSelect={onManualSelect}
          onToggleSlot={toggleSlot}
          participants={meeting.participants}
          selected={selected}
          selectedMatch={selectedMatch}
          showParticipantRoster={mode === "participant"}
        />
      </div>

      <div className="mt-5 space-y-2">
        <label
          className="flex items-center gap-2 text-sm font-medium"
          htmlFor={commentId}
        >
          <MessageSquareText className="size-4 text-primary" />{" "}
          {t("Optional note")}
        </label>
        <Textarea
          className="min-h-24"
          disabled={!meeting.acceptingResponses}
          id={commentId}
          maxLength={1000}
          onChange={(event) => setComment(event.target.value)}
          placeholder={t("For example: I can join 15 minutes late on Wednesday.")}
          value={comment}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{t("Your selections and note autosave after a short pause.")}</span>
          <span>{comment.length}/1000</span>
        </div>
      </div>
    </section>
  );
}

function ParticipantGuidanceDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const { t } = useI18n();
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("Your availability")}</DialogTitle>
          <DialogDescription>
            {t(
              "Tap or drag to mark the times that work for you. On phones, switch days with the navigator below.",
            )}
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <li className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
            {t("Each hour is split into four 15-minute quarters.")}
          </li>
          <li className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
            {t("Selected times are highlighted and saved automatically.")}
          </li>
          <li className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
            {t(
              "Use the same name on another device to reopen this availability.",
            )}
          </li>
        </ul>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button">
            {t("Continue to availability")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const { t } = useI18n();
  const contents = {
    idle: { icon: <Cloud />, label: t("Autosave ready") },
    dirty: { icon: <Cloud />, label: t("Changes pending") },
    saving: {
      icon: <LoaderCircle className="animate-spin" />,
      label: t("Saving…"),
    },
    saved: { icon: <CheckCircle2 />, label: t("Saved") },
    error: { icon: <CloudOff />, label: t("Not saved") },
  }[state];
  return (
    <span
      aria-live="polite"
      className={`flex items-center gap-1.5 text-sm [&_svg]:size-4 ${
        state === "error" ? "text-red-300" : "text-primary"
      }`}
    >
      {contents.icon} {contents.label}
    </span>
  );
}

function ClockBadge() {
  return (
    <span className="grid size-4 place-items-center rounded-full border border-primary/30 bg-primary/10 text-[0.6rem] font-semibold text-primary">
      TZ
    </span>
  );
}

function availabilityKey(response: AvailabilityResponse) {
  return JSON.stringify({
    starts: response.slots.map((slot) => slot.datetimeStart),
    comment: response.comment ?? "",
  });
}
''',
)

write(
    "apps/web/src/components/meetings/best-time-suggestions.tsx",
    r'''"use client";

import type {
  BestMatchDto,
  HeatmapParticipantDto,
} from "@meet-planner/shared-types";
import { motion, useReducedMotion } from "framer-motion";
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
  const holdTimer = useRef<number>();
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
                {revealed && (
                  <p
                    className="mt-2 text-xs leading-relaxed text-primary/80"
                    data-match-participant-names="true"
                  >
                    {names.length ? names.join(", ") : t("No participants available")}
                  </p>
                )}
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
''',
)

write(
    "apps/api/src/meetings/availability-aggregation.ts",
    r'''import type { Meeting } from '@prisma/client';
import { meetingGrid, type MeetingGridSlot } from './meeting-time';

interface ParticipantAvailability {
  id?: string;
  displayName: string;
  availabilities: Array<{
    datetimeStart: Date;
    datetimeEnd: Date;
  }>;
}

export type AvailabilityHeatmapCell = MeetingGridSlot & {
  availableCount: number;
  totalParticipants: number;
  percentage: number;
  participantIds: string[];
  participantNames: string[];
};

export interface RankedMatch {
  datetimeStart: string;
  datetimeEnd: string;
  date: string;
  timeLabel: string;
  availableCount: number;
  totalParticipants: number;
  percentage: number;
  participantIds: string[];
  participantNames: string[];
}

export type AvailabilityAggregationResult = ReturnType<typeof meetingGrid> & {
  heatmap: AvailabilityHeatmapCell[];
  bestTimes: RankedMatch[];
};

interface RankedCandidate {
  match: RankedMatch;
  totalCellAvailability: number;
  minimumCellAvailability: number;
  perfectCellCount: number;
  longestPerfectRun: number;
  attendanceSpread: number;
}

export function aggregateAvailability(
  meeting: Meeting,
  participants: ParticipantAvailability[],
): AvailabilityAggregationResult {
  const grid = meetingGrid(meeting);
  const participantIdsByStart = new Map<string, Set<string>>();
  const participantNameById = new Map<string, string>();

  participants.forEach((participant, index) => {
    const participantId = participant.id ?? `participant:${index}:${participant.displayName}`;
    participantNameById.set(participantId, participant.displayName);
    for (const availability of participant.availabilities) {
      const start = availability.datetimeStart.toISOString();
      const ids = participantIdsByStart.get(start) ?? new Set<string>();
      ids.add(participantId);
      participantIdsByStart.set(start, ids);
    }
  });

  const totalParticipants = participants.length;
  const heatmap: AvailabilityHeatmapCell[] = grid.slots.map((slot) => {
    const participantIds = Array.from(
      participantIdsByStart.get(slot.datetimeStart) ?? [],
    );
    const participantNames = participantIds
      .map((id) => participantNameById.get(id))
      .filter((name): name is string => Boolean(name));
    const availableCount = participantIds.length;
    const percentage = totalParticipants
      ? Math.round((availableCount / totalParticipants) * 100)
      : 0;
    return {
      ...slot,
      availableCount,
      totalParticipants,
      percentage,
      participantIds,
      participantNames,
    };
  });

  const cellsPerMatch =
    meeting.meetingDurationMinutes / meeting.slotIntervalMinutes;
  const candidates = Number.isInteger(cellsPerMatch) && cellsPerMatch > 0
    ? heatmap
        .map((cell, index, cells) =>
          rankedMatchForWindow(
            cells.slice(index, index + cellsPerMatch),
            cellsPerMatch,
            participantIdsByStart,
            participantNameById,
            totalParticipants,
          ),
        )
        .filter((candidate): candidate is RankedCandidate => Boolean(candidate))
        .sort(compareRankedCandidates)
        .map((candidate) => candidate.match)
    : [];

  return {
    ...grid,
    heatmap,
    bestTimes: selectDiverseMatches(candidates, 5),
  };
}

function rankedMatchForWindow(
  window: AvailabilityHeatmapCell[],
  cellsPerMatch: number,
  participantIdsByStart: Map<string, Set<string>>,
  participantNameById: Map<string, string>,
  totalParticipants: number,
): RankedCandidate | undefined {
  const first = window[0];
  if (
    !first ||
    window.length !== cellsPerMatch ||
    window.some((cell) => cell.date !== first.date) ||
    window.some(
      (cell, index) =>
        index > 0 && window[index - 1].datetimeEnd !== cell.datetimeStart,
    )
  ) {
    return undefined;
  }

  const participantSets = window.map(
    (cell) =>
      participantIdsByStart.get(cell.datetimeStart) ?? new Set<string>(),
  );
  const smallest = participantSets.reduce((left, right) =>
    left.size <= right.size ? left : right,
  );
  const participantIds = Array.from(smallest).filter((id) =>
    participantSets.every((ids) => ids.has(id)),
  );
  const participantNames = participantIds
    .map((id) => participantNameById.get(id))
    .filter((name): name is string => Boolean(name));
  const availableCount = participantIds.length;
  if (availableCount === 0) return undefined;

  const cellAvailability = window.map((cell) => cell.availableCount);
  const totalCellAvailability = cellAvailability.reduce(
    (sum, count) => sum + count,
    0,
  );
  const minimumCellAvailability = Math.min(...cellAvailability);
  const maximumCellAvailability = Math.max(...cellAvailability);
  const perfectCells = cellAvailability.map(
    (count) => totalParticipants > 0 && count === totalParticipants,
  );

  return {
    match: {
      datetimeStart: first.datetimeStart,
      datetimeEnd: window.at(-1)!.datetimeEnd,
      date: first.date,
      timeLabel: first.timeLabel,
      availableCount,
      totalParticipants,
      percentage: totalParticipants
        ? Math.round((availableCount / totalParticipants) * 100)
        : 0,
      participantIds,
      participantNames,
    },
    totalCellAvailability,
    minimumCellAvailability,
    perfectCellCount: perfectCells.filter(Boolean).length,
    longestPerfectRun: longestTrueRun(perfectCells),
    attendanceSpread: maximumCellAvailability - minimumCellAvailability,
  };
}

function compareRankedCandidates(
  left: RankedCandidate,
  right: RankedCandidate,
): number {
  return (
    right.match.availableCount - left.match.availableCount ||
    right.totalCellAvailability - left.totalCellAvailability ||
    right.minimumCellAvailability - left.minimumCellAvailability ||
    right.perfectCellCount - left.perfectCellCount ||
    right.longestPerfectRun - left.longestPerfectRun ||
    left.attendanceSpread - right.attendanceSpread ||
    left.match.datetimeStart.localeCompare(right.match.datetimeStart)
  );
}

function longestTrueRun(values: boolean[]): number {
  let longest = 0;
  let current = 0;
  for (const value of values) {
    current = value ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function selectDiverseMatches(
  ranked: RankedMatch[],
  limit: number,
): RankedMatch[] {
  const selected: RankedMatch[] = [];
  for (const candidate of ranked) {
    if (selected.some((match) => matchesOverlap(match, candidate))) continue;
    selected.push(candidate);
    if (selected.length === limit) break;
  }
  return selected;
}

function matchesOverlap(left: RankedMatch, right: RankedMatch): boolean {
  return (
    left.datetimeStart < right.datetimeEnd &&
    right.datetimeStart < left.datetimeEnd
  );
}
''',
)

# Shared API types: public heatmap + stable participant IDs in every heatmap/match.
replace_once(
    "packages/shared-types/src/index.ts",
    '''export interface PublicMeetingDto extends MeetingDto {\n  acceptingResponses: boolean;\n  closedReason?: string;\n  dates: MeetingGridDateDto[];\n  slots: MeetingGridSlotDto[];\n}\n''',
    '''export interface PublicMeetingDto extends MeetingDto {\n  acceptingResponses: boolean;\n  closedReason?: string;\n  dates: MeetingGridDateDto[];\n  slots: MeetingGridSlotDto[];\n  participants: HeatmapParticipantDto[];\n  heatmap: HeatmapCellDto[];\n}\n\nexport interface HeatmapParticipantDto {\n  id: string;\n  displayName: string;\n  isOrganizer?: boolean;\n  responded?: boolean;\n}\n''',
)
replace_once(
    "packages/shared-types/src/index.ts",
    '''  percentage: number;\n  participantNames: string[];\n}\n\nexport interface BestMatchDto {''',
    '''  percentage: number;\n  participantIds: string[];\n  participantNames: string[];\n}\n\nexport interface BestMatchDto {''',
)
replace_once(
    "packages/shared-types/src/index.ts",
    '''  percentage: number;\n  participantNames: string[];\n}\n''',
    '''  percentage: number;\n  participantIds: string[];\n  participantNames: string[];\n}\n''',
)

# Public invitation now receives the same aggregate heatmap and participant roster.
replace_once(
    "apps/api/src/meetings/meetings.service.ts",
    '''  async publicMeeting(slug: string) {\n    const meeting = await this.findBySlug(slug);\n    const closedReason = this.closedReason(meeting);\n    return {\n      ...this.serialize(meeting),\n      acceptingResponses: !closedReason,\n      ...(closedReason ? { closedReason } : {}),\n      ...meetingGrid(meeting),\n    };\n  }\n''',
    '''  async publicMeeting(slug: string) {\n    const meeting = await this.prisma.meeting.findUnique({\n      where: { slug },\n      include: {\n        participants: {\n          orderBy: { joinedAt: 'asc' },\n          select: {\n            id: true,\n            displayName: true,\n            organizerId: true,\n            respondedAt: true,\n            availabilities: {\n              select: { datetimeStart: true, datetimeEnd: true },\n            },\n          },\n        },\n      },\n    });\n    if (!meeting) throw new NotFoundException('Invitation link not found.');\n    const closedReason = this.closedReason(meeting);\n    const availability = aggregateAvailability(meeting, meeting.participants);\n    return {\n      ...this.serialize(meeting),\n      acceptingResponses: !closedReason,\n      ...(closedReason ? { closedReason } : {}),\n      participants: meeting.participants.map((participant) => ({\n        id: participant.id,\n        displayName: participant.organizerId\n          ? 'Organizer'\n          : participant.displayName,\n        ...(participant.organizerId ? { isOrganizer: true } : {}),\n        responded: Boolean(participant.respondedAt),\n      })),\n      ...availability,\n    };\n  }\n''',
)

# Organizer page: one unified heatmap, shared with personal editing and manual final-time selection.
page = ROOT / "apps/web/src/app/dashboard/meetings/[id]/page.tsx"
text = page.read_text(encoding="utf-8")
text = re.sub(
    r'''const HeatmapGrid = dynamic\(\n  \(\) =>\n    import\("@/components/meetings/heatmap-grid"\)\.then\(\n      \(module\) => module\.HeatmapGrid,\n    \),\n  \{ loading: \(\) => <GridLoadingState label="availability heatmap" /> \},\n\);\n''',
    "",
    text,
    count=1,
)
old_state = '  const [manualSelection, setManualSelection] = useState(false);\n'
if old_state not in text:
    raise RuntimeError("manualSelection state anchor missing")
text = text.replace(
    old_state,
    old_state
    + '  const [highlightedMatch, setHighlightedMatch] = useState<BestMatchDto>();\n'
    + '  const [highlightedParticipantIds, setHighlightedParticipantIds] = useState<string[]>([]);\n',
    1,
)
old_sections = r'''          {!data.finalized && (
            <DashboardSection
              icon={<CalendarCheck2 />}
              title={t("Your availability")}
            >
              <AvailabilityGrid
                meeting={data}
                mode="organizer"
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
              />
            </DashboardSection>
          )}

          <div id="manual-time-grid">
            <DashboardSection
              icon={<Flame />}
              title={
                manualSelection
                  ? t("Choose your meeting time")
                  : t("Live availability heatmap")
              }
            >
              <HeatmapGrid
                manualMode={manualSelection && !data.finalized}
                meeting={data}
                onManualSelect={setSelectedMatch}
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
'''
new_sections = r'''          <div id="manual-time-grid">
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
'''
if old_sections not in text:
    raise RuntimeError("organizer grid sections anchor missing")
text = text.replace(old_sections, new_sections, 1)
old_suggestions = '''            <BestTimeSuggestions\n              matches={data.bestTimes}\n              onSelect={'''
new_suggestions = '''            <BestTimeSuggestions\n              matches={data.bestTimes}\n              onHighlight={(match) => {\n                setHighlightedMatch(match);\n                setHighlightedParticipantIds(match?.participantIds ?? []);\n              }}\n              participants={data.participants}\n              onSelect={'''
if old_suggestions not in text:
    raise RuntimeError("BestTimeSuggestions anchor missing")
text = text.replace(old_suggestions, new_suggestions, 1)
old_li = '                    className="flex items-start justify-between gap-3 py-3"\n                    key={participant.id}\n'
new_li = '''                    className={`flex items-start justify-between gap-3 px-2 py-3 transition duration-150 ${\n                      highlightedParticipantIds.includes(participant.id)\n                        ? "rounded-xl bg-emerald-400/10 ring-1 ring-emerald-300/50 shadow-[0_0_18px_rgba(52,211,153,0.16)]"\n                        : ""\n                    }`}\n                    data-highlighted={\n                      highlightedParticipantIds.includes(participant.id)\n                        ? "true"\n                        : "false"\n                    }\n                    data-participant-id={participant.id}\n                    key={participant.id}\n'''
if old_li not in text:
    raise RuntimeError("participant list item anchor missing")
text = text.replace(old_li, new_li, 1)
page.write_text(text, encoding="utf-8")

# Participant invitation: refetch aggregate after a confirmed save and after joining.
public_page = ROOT / "apps/web/src/app/meets/[token]/page.tsx"
text = public_page.read_text(encoding="utf-8")
old_joined = '''    setConfirmedSession({ meetingToken: token, sessionToken: nextToken });\n    notifyParticipantStorage();\n  }\n'''
new_joined = '''    setConfirmedSession({ meetingToken: token, sessionToken: nextToken });\n    notifyParticipantStorage();\n    void queryClient.invalidateQueries({\n      queryKey: ["public-meeting", token],\n      exact: true,\n    });\n  }\n'''
if old_joined not in text:
    raise RuntimeError("public joined anchor missing")
text = text.replace(old_joined, new_joined, 1)
old_public_grid = '''            <AvailabilityGrid\n              key={participantSession.participant.id}\n              meeting={meeting.data}\n              participantSession={participantSession}\n              sessionToken={sessionToken}\n              token={token}\n            />\n'''
new_public_grid = '''            <AvailabilityGrid\n              key={participantSession.participant.id}\n              meeting={meeting.data}\n              onSaved={() =>\n                queryClient.invalidateQueries({\n                  queryKey: ["public-meeting", token],\n                  exact: true,\n                })\n              }\n              participantSession={participantSession}\n              sessionToken={sessionToken}\n              token={token}\n            />\n'''
if old_public_grid not in text:
    raise RuntimeError("public availability grid anchor missing")
text = text.replace(old_public_grid, new_public_grid, 1)
public_page.write_text(text, encoding="utf-8")

# Remove the old centered pseudo-element quarter cue; the unified heatmap renders a small cue itself.
globals_path = ROOT / "apps/web/src/app/globals.css"
globals = globals_path.read_text(encoding="utf-8")
globals = re.sub(
    r'''\n/\* Quarter-of-hour cue inside availability cells\. \*/\nbutton\[data-slot-start\]\[title\$=":00"\][\s\S]*?button\[data-slot-start\]\[aria-pressed="true"\]::after \{\n  --synk-quarter-icon: var\(--primary-foreground\);\n  opacity: 0\.94;\n\}\n?''',
    "\n",
    globals,
    count=1,
)
globals_path.write_text(globals, encoding="utf-8")

# Add translations for the small amount of new UI copy.
translations = {
    "fr": {
        "View": "Voir",
        "Organizer": "Organisateur",
        "Previous day": "Jour précédent",
        "Next day": "Jour suivant",
        "Swipe between days": "Balayez entre les jours",
        "Tap or drag to mark the times that work for you. On phones, switch days with the navigator below.": "Touchez ou faites glisser pour marquer les horaires qui vous conviennent. Sur téléphone, changez de jour avec le navigateur ci-dessous.",
    },
    "ar": {
        "View": "عرض",
        "Organizer": "المنظّم",
        "Previous day": "اليوم السابق",
        "Next day": "اليوم التالي",
        "Swipe between days": "اسحب للتنقل بين الأيام",
        "Tap or drag to mark the times that work for you. On phones, switch days with the navigator below.": "اضغط أو اسحب لتحديد الأوقات المناسبة لك. على الهاتف، بدّل الأيام باستخدام شريط التنقل أسفل الجدول.",
    },
    "ja": {
        "View": "表示",
        "Organizer": "主催者",
        "Previous day": "前の日",
        "Next day": "次の日",
        "Swipe between days": "スワイプして日を切り替え",
        "Tap or drag to mark the times that work for you. On phones, switch days with the navigator below.": "タップまたはドラッグして都合のよい時間を選びます。スマートフォンでは、表の下のナビゲーターで日付を切り替えます。",
    },
    "zh": {
        "View": "查看",
        "Organizer": "组织者",
        "Previous day": "前一天",
        "Next day": "后一天",
        "Swipe between days": "滑动切换日期",
        "Tap or drag to mark the times that work for you. On phones, switch days with the navigator below.": "点击或拖动以标记适合你的时间。在手机上，使用时间表下方的日期导航切换日期。",
    },
    "es": {
        "View": "Ver",
        "Organizer": "Organizador",
        "Previous day": "Día anterior",
        "Next day": "Día siguiente",
        "Swipe between days": "Desliza entre días",
        "Tap or drag to mark the times that work for you. On phones, switch days with the navigator below.": "Toca o arrastra para marcar los horarios que te sirven. En el teléfono, cambia de día con el navegador debajo del horario.",
    },
    "pt": {
        "View": "Ver",
        "Organizer": "Organizador",
        "Previous day": "Dia anterior",
        "Next day": "Próximo dia",
        "Swipe between days": "Deslize entre os dias",
        "Tap or drag to mark the times that work for you. On phones, switch days with the navigator below.": "Toque ou arraste para marcar os horários que funcionam para você. No celular, troque de dia pelo navegador abaixo da grade.",
    },
    "ru": {
        "View": "Просмотр",
        "Organizer": "Организатор",
        "Previous day": "Предыдущий день",
        "Next day": "Следующий день",
        "Swipe between days": "Листайте между днями",
        "Tap or drag to mark the times that work for you. On phones, switch days with the navigator below.": "Нажимайте или проводите, чтобы отметить подходящее время. На телефоне переключайте дни с помощью навигации под расписанием.",
    },
    "de": {
        "View": "Ansehen",
        "Organizer": "Organisator",
        "Previous day": "Vorheriger Tag",
        "Next day": "Nächster Tag",
        "Swipe between days": "Zwischen Tagen wischen",
        "Tap or drag to mark the times that work for you. On phones, switch days with the navigator below.": "Tippe oder ziehe, um passende Zeiten zu markieren. Auf dem Smartphone wechselst du die Tage mit der Navigation unter dem Zeitplan.",
    },
    "nl": {
        "View": "Bekijken",
        "Organizer": "Organisator",
        "Previous day": "Vorige dag",
        "Next day": "Volgende dag",
        "Swipe between days": "Veeg tussen dagen",
        "Tap or drag to mark the times that work for you. On phones, switch days with the navigator below.": "Tik of sleep om de tijden te markeren die voor je werken. Op je telefoon wissel je van dag met de navigator onder het rooster.",
    },
    "hi": {
        "View": "देखें",
        "Organizer": "आयोजक",
        "Previous day": "पिछला दिन",
        "Next day": "अगला दिन",
        "Swipe between days": "दिनों के बीच स्वाइप करें",
        "Tap or drag to mark the times that work for you. On phones, switch days with the navigator below.": "अपने लिए उपयुक्त समय चिह्नित करने के लिए टैप या ड्रैग करें। फ़ोन पर नीचे दिए दिन नेविगेटर से दिन बदलें।",
    },
    "it": {
        "View": "Visualizza",
        "Organizer": "Organizzatore",
        "Previous day": "Giorno precedente",
        "Next day": "Giorno successivo",
        "Swipe between days": "Scorri tra i giorni",
        "Tap or drag to mark the times that work for you. On phones, switch days with the navigator below.": "Tocca o trascina per segnare gli orari che vanno bene per te. Sul telefono cambia giorno con il navigatore sotto la griglia.",
    },
}

i18n_path = ROOT / "apps/web/src/lib/i18n-extra.ts"
i18n = i18n_path.read_text(encoding="utf-8")
for locale, table in translations.items():
    anchor = f"  {locale}: {{\n"
    if anchor not in i18n:
        raise RuntimeError(f"locale anchor missing: {locale}")
    lines = "".join(
        f"    {key!r}: {value!r},\n".replace("'", '"')
        for key, value in table.items()
    )
    i18n = i18n.replace(anchor, anchor + lines, 1)
i18n_path.write_text(i18n, encoding="utf-8")

# Public-service regression coverage for the newly exposed heatmap.
spec_path = ROOT / "apps/api/src/meetings/meetings.service.spec.ts"
spec = spec_path.read_text(encoding="utf-8")
insert = r'''

  it('exposes the same heatmap and participant roster on the public invitation', async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      ...savedMeeting({
        startDate: new Date('2026-08-12T00:00:00.000Z'),
        endDate: new Date('2026-08-12T00:00:00.000Z'),
        workdayStart: '08:00',
        workdayEnd: '09:00',
        slotIntervalMinutes: 60,
      }),
      participants: [
        {
          id: 'participant-1',
          displayName: 'Alice',
          organizerId: null,
          respondedAt: new Date('2026-08-12T06:30:00.000Z'),
          availabilities: [
            {
              datetimeStart: new Date('2026-08-12T07:00:00.000Z'),
              datetimeEnd: new Date('2026-08-12T08:00:00.000Z'),
            },
          ],
        },
      ],
    });

    const result = await service.publicMeeting('a'.repeat(64));

    expect(result.participants).toEqual([
      expect.objectContaining({
        id: 'participant-1',
        displayName: 'Alice',
        responded: true,
      }),
    ]);
    expect(result.heatmap[0]).toMatchObject({
      availableCount: 1,
      totalParticipants: 1,
      participantIds: ['participant-1'],
      participantNames: ['Alice'],
    });
  });
'''
closing = "\n});\n"
if not spec.endswith(closing):
    raise RuntimeError("meetings.service.spec.ts closing anchor missing")
spec = spec[: -len(closing)] + insert + closing
spec_path.write_text(spec, encoding="utf-8")

print("unified selectable heatmap patch applied")
