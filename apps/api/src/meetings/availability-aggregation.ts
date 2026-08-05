import type { Meeting } from '@prisma/client';
import { meetingGrid, type MeetingGridSlot } from './meeting-time';

interface ParticipantAvailability {
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
  participantNames: string[];
}

export type AvailabilityAggregationResult = ReturnType<typeof meetingGrid> & {
  heatmap: AvailabilityHeatmapCell[];
  bestTimes: RankedMatch[];
};

export function aggregateAvailability(
  meeting: Meeting,
  participants: ParticipantAvailability[],
): AvailabilityAggregationResult {
  const grid = meetingGrid(meeting);
  const participantNamesByStart = new Map<string, Set<string>>();

  for (const participant of participants) {
    for (const availability of participant.availabilities) {
      const start = availability.datetimeStart.toISOString();
      const names = participantNamesByStart.get(start) ?? new Set<string>();
      names.add(participant.displayName);
      participantNamesByStart.set(start, names);
    }
  }

  const totalParticipants = participants.length;
  const heatmap: AvailabilityHeatmapCell[] = grid.slots.map((slot) => {
    const participantNames = Array.from(
      participantNamesByStart.get(slot.datetimeStart) ?? [],
    );
    const availableCount = participantNames.length;
    const percentage = totalParticipants
      ? Math.round((availableCount / totalParticipants) * 100)
      : 0;
    return {
      ...slot,
      availableCount,
      totalParticipants,
      percentage,
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
            participantNamesByStart,
            totalParticipants,
          ),
        )
        .filter((match): match is RankedMatch => Boolean(match))
        .sort(compareRankedMatches)
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
  participantNamesByStart: Map<string, Set<string>>,
  totalParticipants: number,
): RankedMatch | undefined {
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
      participantNamesByStart.get(cell.datetimeStart) ?? new Set<string>(),
  );
  const smallest = participantSets.reduce((left, right) =>
    left.size <= right.size ? left : right,
  );
  const participantNames = Array.from(smallest).filter((name) =>
    participantSets.every((names) => names.has(name)),
  );
  const availableCount = participantNames.length;
  if (availableCount === 0) return undefined;

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

function compareRankedMatches(left: RankedMatch, right: RankedMatch): number {
  return (
    right.percentage - left.percentage ||
    right.availableCount - left.availableCount ||
    left.datetimeStart.localeCompare(right.datetimeStart)
  );
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
