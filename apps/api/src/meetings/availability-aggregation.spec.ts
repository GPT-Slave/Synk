import type { Meeting } from '@prisma/client';
import { aggregateAvailability } from './availability-aggregation';
import { meetingGrid } from './meeting-time';

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
  meetingDurationMinutes: 60,
  finalized: false,
  locked: false,
  finalSlotAt: null,
  finalSlotEnd: null,
  createdAt: new Date('2026-08-04T00:00:00.000Z'),
} satisfies Meeting;

describe('aggregateAvailability', () => {
  it('builds exact-percentage heatmap cells with participant-name tooltips', () => {
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
      participantNames: ['Alice'],
    });
    expect(result.heatmap[1].percentage).toBe(0);
  });

  it('uses the organizer-selected duration for contiguous matches', () => {
    const result = aggregateAvailability(
      { ...meeting, meetingDurationMinutes: 90 },
      [
        {
          displayName: 'Alice',
          availabilities: [
            {
              datetimeStart: new Date('2026-08-12T07:00:00.000Z'),
              datetimeEnd: new Date('2026-08-12T07:30:00.000Z'),
            },
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
      ],
    );

    expect(result.bestTimes).toHaveLength(1);
    expect(result.bestTimes[0]).toMatchObject({
      datetimeStart: '2026-08-12T07:00:00.000Z',
      datetimeEnd: '2026-08-12T08:30:00.000Z',
      percentage: 100,
    });
  });

  it('ranks contiguous one-hour matches by overlap and then chronologically', () => {
    const result = aggregateAvailability(meeting, [
      {
        displayName: 'Alice',
        availabilities: [
          {
            datetimeStart: new Date('2026-08-12T07:00:00.000Z'),
            datetimeEnd: new Date('2026-08-12T07:30:00.000Z'),
          },
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
            datetimeStart: new Date('2026-08-12T07:30:00.000Z'),
            datetimeEnd: new Date('2026-08-12T08:00:00.000Z'),
          },
          {
            datetimeStart: new Date('2026-08-12T08:00:00.000Z'),
            datetimeEnd: new Date('2026-08-12T08:30:00.000Z'),
          },
        ],
      },
    ]);

    expect(result.bestTimes.map((slot) => slot.timeLabel)).toEqual([
      '08:30',
      '08:00',
    ]);
    expect(result.bestTimes[0]).toMatchObject({
      availableCount: 2,
      percentage: 100,
      datetimeEnd: '2026-08-12T08:30:00.000Z',
    });
  });

  it('aggregates a 31-day grid for 300 participants within the one-second budget', () => {
    const largeMeeting = {
      ...meeting,
      endDate: new Date('2026-09-11T00:00:00.000Z'),
      workdayEnd: '16:00',
      slotIntervalMinutes: 15,
      meetingDurationMinutes: 60,
    } satisfies Meeting;
    const availableSlots = meetingGrid(largeMeeting).slots.slice(0, 32);
    const participants = Array.from({ length: 300 }, (_, index) => ({
      displayName: `Participant ${index + 1}`,
      availabilities: availableSlots.map((slot) => ({
        datetimeStart: new Date(slot.datetimeStart),
        datetimeEnd: new Date(slot.datetimeEnd),
      })),
    }));

    const startedAt = performance.now();
    const result = aggregateAvailability(largeMeeting, participants);
    const durationMs = performance.now() - startedAt;

    expect(result.heatmap).toHaveLength(992);
    expect(result.bestTimes[0]).toMatchObject({
      availableCount: 300,
      percentage: 100,
    });
    expect(durationMs).toBeLessThan(1_000);
  });
});
