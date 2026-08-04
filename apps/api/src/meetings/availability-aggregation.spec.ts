import type { Meeting } from '@prisma/client';
import { aggregateAvailability } from './availability-aggregation';

const meeting = {
  id: 'meeting-1',
  organizerId: 'user-1',
  title: 'Planning',
  description: null,
  slug: 'a'.repeat(64),
  timezone: 'Africa/Tunis',
  startDate: new Date('2026-08-12T00:00:00.000Z'),
  endDate: new Date('2026-08-12T00:00:00.000Z'),
  workdayStart: '08:00',
  workdayEnd: '10:00',
  slotIntervalMinutes: 30,
  finalized: false,
  finalSlotAt: null,
  responseDeadline: null,
  createdAt: new Date('2026-08-04T00:00:00.000Z'),
} satisfies Meeting;

describe('aggregateAvailability', () => {
  it('builds six-tier heatmap cells with participant-name tooltips', () => {
    const result = aggregateAvailability(meeting, [
      {
        displayName: 'Alice',
        availabilities: [
          {
            datetimeStart: new Date('2026-08-12T07:00:00.000Z'),
            datetimeEnd: new Date('2026-08-12T07:30:00.000Z'),
          },
        ],
      },
      { displayName: 'Bob', availabilities: [] },
      { displayName: 'Charlie', availabilities: [] },
    ]);

    expect(result.heatmap).toHaveLength(4);
    expect(result.heatmap[0]).toMatchObject({
      availableCount: 1,
      totalParticipants: 3,
      percentage: 33,
      tier: 40,
      participantNames: ['Alice'],
    });
    expect(result.heatmap[1].tier).toBe(0);
  });

  it('ranks populated slots by overlap and then chronologically', () => {
    const result = aggregateAvailability(meeting, [
      {
        displayName: 'Alice',
        availabilities: [
          {
            datetimeStart: new Date('2026-08-12T07:30:00.000Z'),
            datetimeEnd: new Date('2026-08-12T08:00:00.000Z'),
          },
          {
            datetimeStart: new Date('2026-08-12T08:00:00.000Z'),
            datetimeEnd: new Date('2026-08-12T08:30:00.000Z'),
          },
        ],
      },
      {
        displayName: 'Bob',
        availabilities: [
          {
            datetimeStart: new Date('2026-08-12T08:00:00.000Z'),
            datetimeEnd: new Date('2026-08-12T08:30:00.000Z'),
          },
        ],
      },
    ]);

    expect(result.bestTimes.map((slot) => slot.timeLabel)).toEqual([
      '09:00',
      '08:30',
    ]);
    expect(result.bestTimes[0]).toMatchObject({
      availableCount: 2,
      percentage: 100,
    });
  });
});
