"use client";

import type {
  HeatmapCellDto,
  HeatmapParticipantDto,
  ParticipantDto,
  PublicMeetingDto,
} from "@meet-planner/shared-types";
import { InteractiveAvailabilityHeatmap } from "@/components/meetings/presented-availability-heatmap";

const DATE = "2026-08-14";
const participants: HeatmapParticipantDto[] = [
  { id: "p1", displayName: "Dhia", responded: false },
  { id: "p2", displayName: "Alice", responded: true },
  { id: "p3", displayName: "Nora", responded: true },
];
const currentParticipant: ParticipantDto = {
  id: "p1",
  displayName: "Dhia",
  joinedAt: "2026-08-14T08:00:00.000Z",
};

function cell(hour: number, minute: number, available: number): HeatmapCellDto {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const start = `${DATE}T${hh}:${mm}:00.000Z`;
  const end = new Date(start);
  end.setUTCMinutes(end.getUTCMinutes() + 15);
  const ids = ["p2", "p3"].slice(0, available);
  return {
    datetimeStart: start,
    datetimeEnd: end.toISOString(),
    date: DATE,
    timeLabel: `${hh}:${mm}`,
    availableCount: ids.length,
    totalParticipants: 3,
    percentage: Math.round((ids.length / 3) * 100),
    participantIds: ids,
    participantNames: ids.map((id) => (id === "p2" ? "Alice" : "Nora")),
  };
}

const heatmap = [9, 10, 11, 12, 13].flatMap((hour, row) =>
  [0, 15, 30, 45].map((minute, quarter) =>
    cell(hour, minute, (row + quarter) % 3),
  ),
);

const meeting: Pick<
  PublicMeetingDto,
  "dates" | "heatmap" | "meetingDurationMinutes" | "slotIntervalMinutes" | "slots"
> = {
  dates: [{ date: DATE, label: "Friday, August 14" }],
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

export default function AvailabilityHintVisualReviewPage() {
  return (
    <main className="min-h-svh px-5 py-7 sm:px-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.16em] text-primary/70">Synk visual review</p>
          <h1 className="mt-2 text-xl font-semibold">Choose when you are free</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Leave the grid untouched to review the idle availability hint.
          </p>
        </div>
        <InteractiveAvailabilityHeatmap
          currentParticipant={currentParticipant}
          editable
          meeting={meeting}
          onToggleSlot={() => undefined}
          participants={participants}
          selected={new Set<string>()}
        />
      </section>
    </main>
  );
}
