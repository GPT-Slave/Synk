"use client";

import type {
  BestMatchDto,
  HeatmapCellDto,
  HeatmapParticipantDto,
  ParticipantDto,
  PublicMeetingDto,
} from "@meet-planner/shared-types";
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
  const { formatDate, t } = useI18n();
  const isMobile = useMobileLayout();
  const [mobileMode, setMobileMode] = useState<MobileInteractionMode>("edit");
  const [activeDateIndex, setActiveDateIndex] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState>();
  const [inspectedParticipantIds, setInspectedParticipantIds] = useState<string[]>([]);
  const dragging = useRef(false);
  const touchedSlot = useRef<string | undefined>(undefined);
  const touchGesture = useRef<TouchGesture | undefined>(undefined);
  const suppressNextMobileClick = useRef(false);

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
      suppressNextMobileClick.current = false;
      const target = event.currentTarget;
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
        suppressNextMobileClick.current = true;
        const box = target.getBoundingClientRect();
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
        distance >= TOUCH_DRAG_THRESHOLD
      ) {
        touch.dragging = true;
        suppressNextMobileClick.current = true;
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

  function activateFromClick(cell: HeatmapCellDto, detail: number) {
    if (detail === 0) {
      keyboardActivate(cell);
      return;
    }
    if (!isMobile) return;
    if (suppressNextMobileClick.current) {
      suppressNextMobileClick.current = false;
      return;
    }
    keyboardActivate(cell);
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

          {hours.map((hour) => (
            <AvailabilityHeatmapRow
              canEditAvailability={canEditAvailability}
              cellByGridPosition={cellByGridPosition}
              dates={visibleDates}
              formatDate={formatDate}
              highlightedMatch={highlightedMatch}
              hour={hour}
              isMobile={isMobile}
              key={hour}
              manualMeetingMode={manualMeetingMode}
              onBlur={clearInspection}
              onFocusCell={inspect}
              onHoverCell={inspect}
              onClickCell={activateFromClick}
              onLeaveCell={clearInspection}
              onPointerDown={startPointer}
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
  isMobile,
  manualMeetingMode,
  onBlur,
  onFocusCell,
  onHoverCell,
  onClickCell,
  onLeaveCell,
  onPointerDown,
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
  isMobile: boolean;
  manualMeetingMode: boolean;
  onBlur: () => void;
  onFocusCell: (cell: HeatmapCellDto, x: number, y: number) => void;
  onHoverCell: (cell: HeatmapCellDto, x: number, y: number) => void;
  onClickCell: (cell: HeatmapCellDto, detail: number) => void;
  onLeaveCell: () => void;
  onPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    cell: HeatmapCellDto,
  ) => void;
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
              const heatStyle = heatmapColor(cell.percentage);
              const style = {
                ...heatStyle,
                "--synk-quarter-fill": `${quarterFill}%`,
                "--synk-heatmap-bg": heatStyle.backgroundColor,
              } as CSSProperties & {
                "--synk-quarter-fill": string;
                "--synk-heatmap-bg": CSSProperties["backgroundColor"];
              };

              return (
                <button
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
                  className={`relative grid min-h-12 place-items-center text-[0.58rem] font-semibold tabular-nums outline-none transition-transform duration-150 focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-primary ${
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
                  data-heatmap-cell="true"
                  data-selected={active ? "true" : "false"}
                  data-slot-start={cell.datetimeStart}
                  key={quarter}
                  onBlur={onBlur}
                  onClick={(event) =>
                    onClickCell(cell, event.detail)
                  }
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
                </button>
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
  const line: CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    zIndex: 20,
    backgroundColor: "rgb(110 231 183)",
  };
  const halo: CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    zIndex: 19,
  };
  return (
    <>
      <span style={{ ...line, left: 0, right: 0, top: -2, height: 2 }} />
      <span style={{ ...halo, left: 0, right: 0, top: -10, height: 8, background: "linear-gradient(to top, rgba(52,211,153,0.55), rgba(52,211,153,0))" }} />
      <span style={{ ...line, left: 0, right: 0, bottom: -2, height: 2 }} />
      <span style={{ ...halo, left: 0, right: 0, bottom: -10, height: 8, background: "linear-gradient(to bottom, rgba(52,211,153,0.55), rgba(52,211,153,0))" }} />
      {!hideLeft && (
        <>
          <span style={{ ...line, top: 0, bottom: 0, left: -2, width: 2 }} />
          <span style={{ ...halo, top: 0, bottom: 0, left: -10, width: 8, background: "linear-gradient(to left, rgba(52,211,153,0), rgba(52,211,153,0.55))" }} />
        </>
      )}
      {!hideRight && (
        <>
          <span style={{ ...line, top: 0, bottom: 0, right: -2, width: 2 }} />
          <span style={{ ...halo, top: 0, bottom: 0, right: -10, width: 8, background: "linear-gradient(to right, rgba(52,211,153,0.55), rgba(52,211,153,0))" }} />
        </>
      )}
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
  const scroller = useRef<HTMLDivElement | null>(null);
  const reportedIndex = useRef(activeIndex);

  function goTo(index: number) {
    const nextIndex = Math.max(0, Math.min(dates.length - 1, index));
    reportedIndex.current = nextIndex;
    onChange(nextIndex);
    const node = scroller.current;
    if (node) {
      node.scrollTo({
        left: nextIndex * node.clientWidth,
        behavior: "smooth",
      });
    }
  }

  function reportScroll() {
    const node = scroller.current;
    if (!node || node.clientWidth === 0) return;
    const nextIndex = Math.max(
      0,
      Math.min(dates.length - 1, Math.round(node.scrollLeft / node.clientWidth)),
    );
    if (nextIndex === reportedIndex.current) return;
    reportedIndex.current = nextIndex;
    onChange(nextIndex);
  }

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
        onClick={() => goTo(activeIndex - 1)}
        type="button"
      >
        <ChevronLeft className="size-5" />
      </button>

      <div
        className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory touch-pan-x rounded-xl border border-white/10 bg-black/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-day-swipe-track="true"
        onScroll={reportScroll}
        ref={scroller}
      >
        <div className="flex min-h-12 w-full">
          {dates.map((date, index) => (
            <div
              className="flex w-full shrink-0 snap-center snap-always select-none items-center justify-center gap-3 px-3 text-center"
              data-day-swipe-page={index}
              key={date.date}
            >
              <MoveHorizontal className="size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">
                  {formatDate(date.date, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <div className="mt-1 flex justify-center gap-1">
                  {dates.map((indicatorDate, indicatorIndex) => (
                    <span
                      aria-hidden="true"
                      className={`h-1 rounded-full transition-all ${
                        indicatorIndex === activeIndex
                          ? "w-4 bg-primary"
                          : "w-1 bg-white/20"
                      }`}
                      key={indicatorDate.date}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        aria-label={t("Next day")}
        className="grid size-10 shrink-0 place-items-center rounded-xl text-primary transition disabled:opacity-25"
        disabled={activeIndex === dates.length - 1}
        onClick={() => goTo(activeIndex + 1)}
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
  const start = { r: 6, g: 16, b: 28 };
  const end = { r: 0, g: 148, b: 255 };
  const mix = (from: number, to: number) =>
    Math.round(from + (to - from) * normalized);
  const red = mix(start.r, end.r);
  const green = mix(start.g, end.g);
  const blue = mix(start.b, end.b);
  return {
    backgroundColor: `rgb(${red} ${green} ${blue})`,
    borderColor: `rgba(96, 165, 250, ${(0.12 + normalized * 0.58).toFixed(3)})`,
    boxShadow: `inset 0 0 ${Math.round(8 + normalized * 18)}px rgba(56, 189, 248, ${(normalized * 0.22).toFixed(3)})`,
    color: normalized >= 0.48 ? "rgb(248 250 252)" : "rgb(186 230 253)",
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
