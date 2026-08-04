import type { Meeting } from '@prisma/client';
import { meetingGrid } from './meeting-time';

interface ParticipantAvailability {
  displayName: string;
  availabilities: Array<{
    datetimeStart: Date;
    datetimeEnd: Date;
  }>;
}

export function aggregateAvailability(
  meeting: Meeting,
  participants: ParticipantAvailability[],
) {
  const grid = meetingGrid(meeting);
  const participantNamesByStart = new Map<string, string[]>();

  for (const participant of participants) {
    for (const availability of participant.availabilities) {
      const start = availability.datetimeStart.toISOString();
      const names = participantNamesByStart.get(start) ?? [];
      names.push(participant.displayName);
      participantNamesByStart.set(start, names);
    }
  }

  const totalParticipants = participants.length;
  const heatmap = grid.slots.map((slot) => {
    const participantNames =
      participantNamesByStart.get(slot.datetimeStart) ?? [];
    const availableCount = participantNames.length;
    const percentage = totalParticipants
      ? Math.round((availableCount / totalParticipants) * 100)
      : 0;
    const tier =
      percentage === 0 ? 0 : Math.min(100, Math.ceil(percentage / 20) * 20);

    return {
      ...slot,
      availableCount,
      totalParticipants,
      percentage,
      tier: tier as 0 | 20 | 40 | 60 | 80 | 100,
      participantNames,
    };
  });

  const bestTimes = heatmap
    .filter((cell) => cell.availableCount > 0)
    .sort(
      (left, right) =>
        right.availableCount - left.availableCount ||
        left.datetimeStart.localeCompare(right.datetimeStart),
    )
    .slice(0, 5)
    .map((cell) => ({
      datetimeStart: cell.datetimeStart,
      datetimeEnd: cell.datetimeEnd,
      date: cell.date,
      timeLabel: cell.timeLabel,
      availableCount: cell.availableCount,
      totalParticipants: cell.totalParticipants,
      percentage: cell.percentage,
      participantNames: cell.participantNames,
    }));

  return { ...grid, heatmap, bestTimes };
}
