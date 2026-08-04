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
    return {
      ...slot,
      availableCount,
      totalParticipants,
      percentage,
      participantNames,
    };
  });

  const cellsPerMatch = Math.max(
    1,
    meeting.meetingDurationMinutes / meeting.slotIntervalMinutes,
  );
  const bestTimes = heatmap
    .map((cell, index, cells) => {
      const window = cells.slice(index, index + cellsPerMatch);
      if (
        window.length !== cellsPerMatch ||
        window.some((next) => next.date !== cell.date) ||
        window.some(
          (next, windowIndex) =>
            windowIndex > 0 &&
            window[windowIndex - 1].datetimeEnd !== next.datetimeStart,
        )
      ) {
        return undefined;
      }

      const participantNames = cell.participantNames.filter((name) =>
        window.every((next) => next.participantNames.includes(name)),
      );
      const availableCount = participantNames.length;
      const percentage = totalParticipants
        ? Math.round((availableCount / totalParticipants) * 100)
        : 0;
      return {
        datetimeStart: cell.datetimeStart,
        datetimeEnd: window.at(-1)!.datetimeEnd,
        date: cell.date,
        timeLabel: cell.timeLabel,
        availableCount,
        totalParticipants,
        percentage,
        participantNames,
      };
    })
    .filter((match): match is NonNullable<typeof match> =>
      Boolean(match && match.availableCount > 0),
    )
    .sort(
      (left, right) =>
        right.percentage - left.percentage ||
        right.availableCount - left.availableCount ||
        left.datetimeStart.localeCompare(right.datetimeStart),
    )
    .slice(0, 5);

  return { ...grid, heatmap, bestTimes };
}
