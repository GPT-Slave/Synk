"use client";

import type {
  HeatmapCellDto,
  HeatmapParticipantDto,
  ParticipantDto,
  PublicMeetingDto,
} from "@meet-planner/shared-types";
import { useMemo, useState } from "react";
import { InteractiveAvailabilityHeatmap } from "@/components/meetings/presented-availability-heatmap";

const DATES = ["2026-08-15", "2026-08-16"];

const participants: HeatmapParticipantDto[] = [
  { id: "p1", displayName: "Dhia", responded: false },
  { id: "p2", displayName: "Alice", responded: true },
  { id: "p3", displayName: "Nora", responded: true },
];

const currentParticipant: ParticipantDto = {
  id: "p1",
  displayName: "Dhia",
  joinedAt: "2026-08-15T08:00:00.000Z",
};

function cell(date: string, hour: number, minute: number, available: number): HeatmapCellDto {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const start = `${date}T${hh}:${mm}:00.000Z`;
  const end = new Date(start);
  end.setUTCMinutes(end.getUTCMinutes() + 15);
  const ids = ["p2", "p3"].slice(0, available);
  return {
    datetimeStart: start,
    datetimeEnd: end.toISOString(),
    date,
    timeLabel: `${hh}:${mm}`,
    availableCount: ids.length,
    totalParticipants: 3,
    percentage: Math.round((ids.length / 3) * 100),
    participantIds: ids,
    participantNames: ids.map((id) => (id === "p2" ? "Alice" : "Nora")),
  };
}

const heatmap = DATES.flatMap((date, dateIndex) =>
  [9, 10, 11, 12, 13, 14].flatMap((hour, row) =>
    [0, 15, 30, 45].map((minute, quarter) =>
      cell(date, hour, minute, (dateIndex + row + quarter) % 3),
    ),
  ),
);

const meeting: Pick<
  PublicMeetingDto,
  "dates" | "heatmap" | "meetingDurationMinutes" | "slotIntervalMinutes" | "slots"
> = {
  dates: DATES.map((date) => ({ date, label: date })),
  heatmap,
  meetingDurationMinutes: 60,
  slotIntervalMinutes: 15,
  slots: heatmap.map(({ datetimeStart, datetimeEnd, date, timeLabel }) => ({
    datetimeStart,
    datetimeEnd,
    date,
    timeLabel,
  })),
};

export default function MobileTouchVisualReviewPage() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectedList = useMemo(() => Array.from(selected).sort(), [selected]);

  return (
    <main className="min-h-[180vh] px-5 py-8">
      <div className="h-28" aria-hidden="true" />
      <section className="mx-auto max-w-4xl">
        <p className="text-xs uppercase tracking-[0.16em] text-primary/70">Synk mobile touch review</p>
        <h1 className="mt-2 text-xl font-semibold">Touch availability selection</h1>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          Horizontal tile sweeps select. Vertical movement scrolls. The strip below changes days.
        </p>
        <output data-test-selected-count="true" className="sr-only">
          {selectedList.length}
        </output>
        <output data-test-selected-values="true" className="sr-only">
          {selectedList.join("|")}
        </output>
        <InteractiveAvailabilityHeatmap
          currentParticipant={currentParticipant}
          editable
          meeting={meeting}
          onToggleSlot={(slotStart) => {
            setSelected((current) => {
              const next = new Set(current);
              if (next.has(slotStart)) next.delete(slotStart);
              else next.add(slotStart);
              return next;
            });
          }}
          participants={participants}
          selected={selected}
        />
      </section>
      <div className="h-[70vh]" aria-hidden="true" />
    </main>
  );
}
