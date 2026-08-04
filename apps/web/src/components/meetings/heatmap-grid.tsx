"use client";

import type { HeatmapCellDto } from "@meet-planner/shared-types";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { StatePanel } from "@/components/ui/state-panel";
import type { OrganizerMeetingDetail } from "@/lib/meeting-api";

interface TooltipState {
  cell: HeatmapCellDto;
  x: number;
  y: number;
}

export function HeatmapGrid({ meeting }: { meeting: OrganizerMeetingDetail }) {
  const [tooltip, setTooltip] = useState<TooltipState>();
  const times = useMemo(
    () => Array.from(new Set(meeting.heatmap.map((cell) => cell.timeLabel))),
    [meeting.heatmap],
  );
  const cellByGridPosition = useMemo(
    () =>
      new Map(
        meeting.heatmap.map((cell) => [`${cell.date}:${cell.timeLabel}`, cell]),
      ),
    [meeting.heatmap],
  );

  if (meeting.dates.length === 0 || meeting.heatmap.length === 0) {
    return (
      <StatePanel
        description="The heatmap will appear when this meeting has valid schedule slots."
        title="No heatmap data"
      />
    );
  }

  function showTooltip(cell: HeatmapCellDto, x: number, y: number) {
    setTooltip({ cell, x, y });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {meeting.participantCount
            ? "Hover or focus a square to see who is available."
            : "The heatmap will fill as participants respond."}
        </p>
        <div className="flex items-center gap-2" aria-label="Heatmap legend">
          <span className="text-[0.65rem] text-muted-foreground">0%</span>
          <span className="heatmap-gradient h-2.5 w-28 rounded-full border border-white/10" />
          <span className="text-[0.65rem] text-muted-foreground">100%</span>
        </div>
      </div>

      <div className="schedule-scroll max-h-[68svh] overflow-auto rounded-2xl border border-white/10 bg-black/10 overscroll-x-contain overscroll-y-auto">
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `4.75rem repeat(${meeting.dates.length}, minmax(8.5rem, 1fr))`,
          }}
        >
          <div className="sticky left-0 top-0 z-30 border-b border-r border-white/10 bg-card/95 backdrop-blur-xl" />
          {meeting.dates.map((date) => (
            <div
              className="sticky top-0 z-20 border-b border-r border-white/10 bg-card/95 px-2 py-3 text-center text-xs font-medium backdrop-blur-xl last:border-r-0"
              key={date.date}
            >
              {date.label}
            </div>
          ))}

          {times.map((time) => (
            <HeatmapRow
              cellByGridPosition={cellByGridPosition}
              dates={meeting.dates}
              key={time}
              onHide={() => setTooltip(undefined)}
              onShow={showTooltip}
              time={time}
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
            {tooltip.cell.availableCount} / {tooltip.cell.totalParticipants}{" "}
            available
          </p>
          <p className="mt-1 text-muted-foreground">
            {tooltip.cell.participantNames.length
              ? tooltip.cell.participantNames.join(", ")
              : "No participants available"}
          </p>
        </div>
      )}
    </div>
  );
}

function HeatmapRow({
  cellByGridPosition,
  dates,
  onHide,
  onShow,
  time,
}: {
  cellByGridPosition: Map<string, HeatmapCellDto>;
  dates: OrganizerMeetingDetail["dates"];
  onHide: () => void;
  onShow: (cell: HeatmapCellDto, x: number, y: number) => void;
  time: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <>
      <div className="sticky left-0 z-10 border-b border-r border-white/10 bg-card/95 px-3 py-5 text-xs text-muted-foreground backdrop-blur-xl">
        {time}
      </div>
      {dates.map((date) => {
        const cell = cellByGridPosition.get(`${date.date}:${time}`);
        if (!cell) return <div key={date.date} />;
        const color = heatmapColor(cell.percentage);
        return (
          <div
            className="min-h-14 border-b border-r border-white/10 p-1.5 last:border-r-0"
            key={date.date}
          >
            <motion.button
              aria-label={`${date.label} at ${time}: ${cell.availableCount} of ${cell.totalParticipants} available${cell.participantNames.length ? ` — ${cell.participantNames.join(", ")}` : ""}`}
              className="grid size-full min-h-11 place-items-center rounded-xl border text-[0.68rem] font-semibold tabular-nums outline-none transition duration-200 hover:brightness-125 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary"
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
              style={color}
              type="button"
              whileHover={reduceMotion ? undefined : { scale: 1.025 }}
            >
              {cell.availableCount}/{cell.totalParticipants}
            </motion.button>
          </div>
        );
      })}
    </>
  );
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
