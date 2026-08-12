import type { Meeting } from '@prisma/client';
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
    const participantId =
      participant.id ?? `participant:${index}:${participant.displayName}`;
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
  const candidates =
    Number.isInteger(cellsPerMatch) && cellsPerMatch > 0
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
          .filter((candidate): candidate is RankedCandidate =>
            Boolean(candidate),
          )
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
