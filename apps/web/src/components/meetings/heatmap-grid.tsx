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
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label="Heatmap legend"
        >
          {([0, 20, 40, 60, 80, 100] as const).map((tier) => (
            <span
              className="flex items-center gap-1 text-[0.65rem] text-muted-foreground"
              key={tier}
            >
              <span className={`size-2.5 rounded-sm ${tierClass(tier)}`} />
              {tier}%
            </span>
          ))}
        </div>
      </div>

      <div className="schedule-scroll max-h-[68svh] overflow-auto rounded-2xl border border-white/10 bg-black/10 overscroll-contain">
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
        return (
          <motion.button
            aria-label={`${date.label} at ${time}: ${cell.availableCount} of ${cell.totalParticipants} available${cell.participantNames.length ? ` — ${cell.participantNames.join(", ")}` : ""}`}
            className={`grid min-h-14 place-items-center border-b border-r border-white/10 text-[0.68rem] font-semibold tabular-nums outline-none transition duration-200 last:border-r-0 hover:brightness-125 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary ${tierClass(cell.tier)}`}
            key={date.date}
            onBlur={onHide}
            onFocus={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              onShow(cell, box.left + box.width / 2, box.top);
            }}
            onMouseEnter={(event) => onShow(cell, event.clientX, event.clientY)}
            onMouseLeave={onHide}
            onMouseMove={(event) => onShow(cell, event.clientX, event.clientY)}
            type="button"
            whileHover={reduceMotion ? undefined : { scale: 1.025 }}
          >
            {cell.availableCount}/{cell.totalParticipants}
          </motion.button>
        );
      })}
    </>
  );
}

function tierClass(tier: HeatmapCellDto["tier"]) {
  return {
    0: "bg-white/[0.035] text-white/35",
    20: "bg-red-500/35 text-red-50",
    40: "bg-orange-500/40 text-orange-50",
    60: "bg-yellow-400/45 text-yellow-50",
    80: "bg-green-500/50 text-green-50",
    100: "bg-emerald-500/70 text-emerald-50 shadow-[inset_0_0_20px_oklch(0.7_0.18_155_/_0.18)]",
  }[tier];
}
