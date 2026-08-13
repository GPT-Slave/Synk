"use client";

import type {
  BestMatchDto,
  HeatmapCellDto,
  HeatmapParticipantDto,
  ParticipantDto,
  PublicMeetingDto,
} from "@meet-planner/shared-types";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BestTimeSuggestions } from "@/components/meetings/best-time-suggestions";
import { InteractiveAvailabilityHeatmap } from "@/components/meetings/presented-availability-heatmap";

const DATE = "2026-08-14";
const participants: HeatmapParticipantDto[] = [
  { id: "p1", displayName: "Dhia", responded: true },
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
  const endDate = new Date(start);
  endDate.setUTCMinutes(endDate.getUTCMinutes() + 15);
  const ids = ["p2", "p3"].slice(0, Math.max(0, available - 1));
  return {
    datetimeStart: start,
    datetimeEnd: endDate.toISOString(),
    date: DATE,
    timeLabel: `${hh}:${mm}`,
    availableCount: ids.length,
    totalParticipants: 3,
    percentage: Math.round((ids.length / 3) * 100),
    participantIds: ids,
    participantNames: ids.map((id) => (id === "p2" ? "Alice" : "Nora")),
  };
}

const heatmap = [9, 10, 11, 12].flatMap((hour, row) =>
  [0, 15, 30, 45].map((minute, quarter) =>
    cell(hour, minute, ((row + quarter) % 3) + 1),
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

const selected = new Set([
  `${DATE}T09:00:00.000Z`,
  `${DATE}T09:15:00.000Z`,
  `${DATE}T10:00:00.000Z`,
  `${DATE}T10:15:00.000Z`,
  `${DATE}T12:30:00.000Z`,
]);

const match: BestMatchDto = {
  datetimeStart: `${DATE}T11:00:00.000Z`,
  datetimeEnd: `${DATE}T12:00:00.000Z`,
  date: DATE,
  timeLabel: "11:00",
  availableCount: 2,
  totalParticipants: 3,
  percentage: 67,
  participantIds: ["p2", "p3"],
  participantNames: ["Alice", "Nora"],
};

interface Diagnostics {
  selectedBackground?: string;
  selectedAnimation?: string;
  selectedBarBackground?: string;
  selectedBarAnimation?: string;
  highlightedBackground?: string;
  highlightedFilter?: string;
  highlightedShadow?: string;
}

export default function AvailabilityVisualReviewPage() {
  const searchParams = useSearchParams();
  const highlightedMatch = searchParams.get("highlight") === "1" ? match : undefined;
  const selectedSnapshot = useMemo(() => new Set(selected), []);
  const [diagnostics, setDiagnostics] = useState<Diagnostics>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const selectedButton = document.querySelector<HTMLElement>(
        'button[data-heatmap-cell="true"][aria-pressed="true"]',
      );
      const highlightedButton = document.querySelector<HTMLElement>(
        'button[data-heatmap-cell="true"].brightness-125:not([aria-pressed="true"])',
      );
      const selectedStyle = selectedButton
        ? window.getComputedStyle(selectedButton)
        : undefined;
      const selectedBarStyle = selectedButton
        ? window.getComputedStyle(selectedButton, "::before")
        : undefined;
      const highlightedStyle = highlightedButton
        ? window.getComputedStyle(highlightedButton)
        : undefined;
      setDiagnostics({
        selectedBackground: selectedStyle?.background,
        selectedAnimation: selectedStyle?.animationName,
        selectedBarBackground: selectedBarStyle?.background,
        selectedBarAnimation: selectedBarStyle?.animationName,
        highlightedBackground: highlightedStyle?.backgroundColor,
        highlightedFilter: highlightedStyle?.filter,
        highlightedShadow: highlightedStyle?.boxShadow,
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [highlightedMatch]);

  return (
    <main className="min-h-svh px-5 py-7">
      <section className="mx-auto max-w-xl">
        <div className="mb-5">
          <h1 className="text-lg font-semibold">Selected availability visual review</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Real Synk heatmap component rendered with deterministic fixture data.
          </p>
          <pre className="mt-2 whitespace-pre-wrap break-all text-[9px] text-muted-foreground" data-visual-diagnostics="true">
            {JSON.stringify(diagnostics)}
          </pre>
        </div>

        <InteractiveAvailabilityHeatmap
          currentParticipant={currentParticipant}
          editable
          highlightedMatch={highlightedMatch}
          meeting={meeting}
          onToggleSlot={() => undefined}
          participants={participants}
          selected={selectedSnapshot}
        />

        <div className="mt-8" data-visual-suggestion="true">
          <BestTimeSuggestions
            matches={[match]}
            onHighlight={() => undefined}
            participants={participants}
            timezone="UTC"
          />
        </div>
      </section>
    </main>
  );
}
