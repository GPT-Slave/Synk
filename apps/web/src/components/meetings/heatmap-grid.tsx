"use client";

import type { BestMatchDto, HeatmapCellDto } from "@meet-planner/shared-types";
import { motion, useReducedMotion } from "framer-motion";
import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { StatePanel } from "@/components/ui/state-panel";
import { useI18n } from "@/lib/i18n";
import type { OrganizerMeetingDetail } from "@/lib/meeting-api";

interface TooltipState {
  cell: HeatmapCellDto;
  x: number;
  y: number;
}

export function HeatmapGrid({
  highlightedMatch,
  manualMode = false,
  meeting,
  onManualSelect,
  selectedMatch,
}: {
  highlightedMatch?: BestMatchDto;
  manualMode?: boolean;
  meeting: OrganizerMeetingDetail;
  onManualSelect?: (match: BestMatchDto) => void;
  selectedMatch?: BestMatchDto;
}) {
  const [tooltip, setTooltip] = useState<TooltipState>();
  const [suggestionHighlight, setSuggestionHighlight] = useState<BestMatchDto>();
  const { formatDate, formatDuration, t } = useI18n();
  const hours = useMemo(
    () =>
      Array.from(
        new Set(
          meeting.heatmap.map((cell) => `${cell.timeLabel.slice(0, 2)}:00`),
        ),
      ),
    [meeting.heatmap],
  );
  const cellByGridPosition = useMemo(
    () =>
      new Map(
        meeting.heatmap.map((cell) => [`${cell.date}:${cell.timeLabel}`, cell]),
      ),
    [meeting.heatmap],
  );

  useEffect(() => {
    function receiveHighlight(event: Event) {
      setSuggestionHighlight(
        (event as CustomEvent<BestMatchDto | undefined>).detail,
      );
    }
    window.addEventListener("synk:suggestion-highlight", receiveHighlight);
    return () =>
      window.removeEventListener("synk:suggestion-highlight", receiveHighlight);
  }, []);

  const activeHighlightedMatch = highlightedMatch ?? suggestionHighlight;

  if (meeting.dates.length === 0 || meeting.heatmap.length === 0) {
    return (
      <StatePanel
        description={t(
          "The heatmap will appear when this meeting has valid schedule slots.",
        )}
        title={t("No heatmap data")}
      />
    );
  }

  function showTooltip(cell: HeatmapCellDto, x: number, y: number) {
    setTooltip({ cell, x, y });
  }

  function chooseManualTime(cell: HeatmapCellDto) {
    if (!manualMode || !onManualSelect) return;
    const match = manualMatchForCell(meeting, cell.datetimeStart);
    if (match) onManualSelect(match);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {manualMode
            ? t("Choose a start square or drag across the grid. Synk highlights the full {duration} meeting.", {
                duration: formatDuration(meeting.meetingDurationMinutes),
              })
            : meeting.participantCount
              ? t("Hover or focus a square to see who is available.")
              : t("The heatmap will fill as participants respond.")}
        </p>
        <div className="flex items-center gap-2" aria-label={t("Heatmap legend")}>
          <span className="text-[0.65rem] text-muted-foreground">0%</span>
          <span className="heatmap-gradient h-2.5 w-28 rounded-full border border-white/10" />
          <span className="text-[0.65rem] text-muted-foreground">100%</span>
        </div>
      </div>

      <div className="w-full">
        <div
          className="grid w-full min-w-0"
          style={{
            gridTemplateColumns: `4.25rem repeat(${meeting.dates.length}, minmax(0, 1fr))`,
          }}
        >
          <div />
          {meeting.dates.map((date) => (
            <div
              className="min-w-0 truncate px-1 py-3 text-center text-[0.68rem] font-medium leading-tight text-muted-foreground sm:text-xs"
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
            <HeatmapRow
              cellByGridPosition={cellByGridPosition}
              dates={meeting.dates}
              formatDate={formatDate}
              highlightedMatch={activeHighlightedMatch}
              hour={hour}
              key={hour}
              manualMode={manualMode}
              onHide={() => setTooltip(undefined)}
              onManualSelect={chooseManualTime}
              onShow={showTooltip}
              selectedMatch={selectedMatch}
              t={t}
            />
          ))}
        </div>
      </div>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 w-52 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl border border-white/15 bg-[#07111f]/98 p-3 text-xs shadow-2xl backdrop-blur-xl"
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
            {tooltip.cell.participantNames.length
              ? tooltip.cell.participantNames.join(", ")
              : t("No participants available")}
          </p>
        </div>
      )}
    </div>
  );
}

function HeatmapRow({
  cellByGridPosition,
  dates,
  formatDate,
  highlightedMatch,
  hour,
  manualMode,
  onHide,
  onManualSelect,
  onShow,
  selectedMatch,
  t,
}: {
  cellByGridPosition: Map<string, HeatmapCellDto>;
  dates: OrganizerMeetingDetail["dates"];
  formatDate: (
    value: Date | string,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  highlightedMatch?: BestMatchDto;
  hour: string;
  manualMode: boolean;
  onHide: () => void;
  onManualSelect: (cell: HeatmapCellDto) => void;
  onShow: (cell: HeatmapCellDto, x: number, y: number) => void;
  selectedMatch?: BestMatchDto;
  t: (message: string, variables?: Record<string, string | number>) => string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <>
      <div className="px-2 py-5 text-xs text-muted-foreground">{hour}</div>
      {dates.map((date) => (
        <div className="min-h-14 p-1" key={date.date}>
          <div className="grid size-full min-h-11 grid-cols-4 overflow-hidden rounded-xl border border-white/10">
            {[0, 15, 30, 45].map((quarter) => {
              const time = `${hour.slice(0, 3)}${String(quarter).padStart(2, "0")}`;
              const cell = cellByGridPosition.get(`${date.date}:${time}`);
              if (!cell)
                return (
                  <span
                    aria-hidden="true"
                    className="bg-white/[0.01]"
                    key={quarter}
                  />
                );
              const color = heatmapColor(cell.percentage);
              const selected = isCellInsideMatch(cell, selectedMatch);
              const highlighted = isCellInsideMatch(cell, highlightedMatch);
              const dateLabel = formatDate(date.date, {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              const participantNames = cell.participantNames.length
                ? ` — ${cell.participantNames.join(", ")}`
                : "";
              return (
                <motion.button
                  aria-label={t(
                    "{date} at {time}: {available} of {total} available{names}",
                    {
                      date: dateLabel,
                      time,
                      available: cell.availableCount,
                      total: cell.totalParticipants,
                      names: participantNames,
                    },
                  )}
                  aria-pressed={manualMode ? selected : undefined}
                  className={`grid min-h-11 touch-pan-y place-items-center text-[0.58rem] font-semibold tabular-nums outline-none transition duration-200 hover:brightness-125 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary ${manualMode ? "cursor-crosshair" : ""} ${selected ? "relative z-[1] ring-2 ring-inset ring-primary" : ""} ${highlighted ? "relative z-[2] brightness-125 ring-2 ring-inset ring-primary shadow-[0_0_24px_4px_oklch(0.82_0.18_245_/_0.55)]" : ""}`}
                  key={quarter}
                  onBlur={onHide}
                  onFocus={(event) => {
                    const box = event.currentTarget.getBoundingClientRect();
                    onShow(cell, box.left + box.width / 2, box.top);
                  }}
                  onMouseEnter={(event) =>
                    onShow(cell, event.clientX, event.clientY)
                  }
                  onMouseLeave={onHide}
                  onMouseMove={(event) =>
                    onShow(cell, event.clientX, event.clientY)
                  }
                  onClick={(event) => {
                    const pointerType = (event.nativeEvent as PointerEvent)
                      .pointerType;
                    if (event.detail === 0 || pointerType === "touch")
                      onManualSelect(cell);
                  }}
                  onPointerDown={(event) => {
                    if (
                      !manualMode ||
                      event.pointerType !== "mouse" ||
                      event.button !== 0
                    )
                      return;
                    event.preventDefault();
                    onManualSelect(cell);
                  }}
                  onPointerEnter={(
                    event: ReactPointerEvent<HTMLButtonElement>,
                  ) => {
                    if (
                      manualMode &&
                      event.pointerType === "mouse" &&
                      event.buttons === 1
                    )
                      onManualSelect(cell);
                  }}
                  style={color}
                  title={`${time} · ${cell.availableCount}/${cell.totalParticipants}`}
                  type="button"
                  whileHover={reduceMotion ? undefined : { scale: 1.025 }}
                >
                  {cell.availableCount}/{cell.totalParticipants}
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
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

export function manualMatchForCell(
  meeting: OrganizerMeetingDetail,
  datetimeStart: string,
): BestMatchDto | undefined {
  const startIndex = meeting.heatmap.findIndex(
    (cell) => cell.datetimeStart === datetimeStart,
  );
  const cellsPerMeeting =
    meeting.meetingDurationMinutes / meeting.slotIntervalMinutes;
  if (startIndex < 0 || !Number.isInteger(cellsPerMeeting)) return undefined;

  const window = meeting.heatmap.slice(
    startIndex,
    startIndex + cellsPerMeeting,
  );
  const first = window[0];
  if (
    !first ||
    window.length !== cellsPerMeeting ||
    window.some((cell) => cell.date !== first.date) ||
    window.some(
      (cell, index) =>
        index > 0 && window[index - 1].datetimeEnd !== cell.datetimeStart,
    )
  ) {
    return undefined;
  }

  const participantNames = first.participantNames.filter((name) =>
    window.every((cell) => cell.participantNames.includes(name)),
  );
  const availableCount = participantNames.length;
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
    participantNames,
  };
}

export function heatmapColor(percentage: number) {
  const normalized = Math.max(0, Math.min(100, percentage)) / 100;
  const lightness = 0.17 + normalized * 0.49;
  const chroma = 0.025 + normalized * 0.155;
  const alpha = 0.65 + normalized * 0.35;
  return {
    backgroundColor: `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} 245 / ${alpha.toFixed(3)})`,
    borderColor: `oklch(0.82 0.18 245 / ${(0.12 + normalized * 0.58).toFixed(3)})`,
    boxShadow: `inset 0 0 ${Math.round(8 + normalized * 18)}px oklch(0.82 0.18 245 / ${(normalized * 0.24).toFixed(3)})`,
    color:
      normalized >= 0.48 ? "oklch(0.985 0.01 245)" : "oklch(0.78 0.035 245)",
  };
}
