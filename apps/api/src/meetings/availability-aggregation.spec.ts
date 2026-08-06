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
  slotIntervalMinutes: 15,
  meetingDurationMinutes: 60,
  finalized: false,
  locked: false,
  finalSlotAt: null,
  finalSlotEnd: null,
  createdAt: new Date('2026-08-04T00:00:00.000Z'),
} satisfies Meeting;

const quarter = (start: string, end: string) => ({
  datetimeStart: new Date(start),
  datetimeEnd: new Date(end),
});

describe('aggregateAvailability', () => {
  it('builds exact-percentage heatmap cells with participant-name tooltips', () => {
    const result = aggregateAvailability(meeting, [
      {
        displayName: 'Alice',
        availabilities: [
          quarter(
            '2026-08-12T07:00:00.000Z',
            '2026-08-12T07:15:00.000Z',
          ),
        ],
      },
      { displayName: 'Bob', availabilities: [] },
      { displayName: 'Charlie', availabilities: [] },
    ]);

    expect(result.heatmap).toHaveLength(8);
    expect(result.heatmap[0]).toMatchObject({
      availableCount: 1,
      totalParticipants: 3,
      percentage: 33,
      participantNames: ['Alice'],
    });
    expect(result.heatmap[1].percentage).toBe(0);
  });

  it('allows a suggestion to start on any quarter hour', () => {
    const result = aggregateAvailability(meeting, [
      {
        displayName: 'Alice',
        availabilities: [
          quarter(
            '2026-08-12T07:15:00.000Z',
            '2026-08-12T07:30:00.000Z',
          ),
          quarter(
            '2026-08-12T07:30:00.000Z',
            '2026-08-12T07:45:00.000Z',
          ),
          quarter(
            '2026-08-12T07:45:00.000Z',
            '2026-08-12T08:00:00.000Z',
          ),
          quarter(
            '2026-08-12T08:00:00.000Z',
            '2026-08-12T08:15:00.000Z',
          ),
        ],
      },
    ]);

    expect(result.bestTimes).toHaveLength(1);
    expect(result.bestTimes[0]).toMatchObject({
      timeLabel: '08:15',
      datetimeStart: '2026-08-12T07:15:00.000Z',
      datetimeEnd: '2026-08-12T08:15:00.000Z',
      percentage: 100,
    });
  });

  it('requires every quarter in the requested meeting duration', () => {
    const result = aggregateAvailability(
      { ...meeting, meetingDurationMinutes: 90 },
      [
        {
          displayName: 'Alice',
          availabilities: meetingGrid(meeting).slots
            .slice(0, 6)
            .map((slot) =>
              quarter(slot.datetimeStart, slot.datetimeEnd),
            ),
        },
      ],
    );

    expect(result.bestTimes).toHaveLength(1);
    expect(result.bestTimes[0]).toMatchObject({
      timeLabel: '08:00',
      datetimeEnd: '2026-08-12T08:30:00.000Z',
      percentage: 100,
    });
  });

  it('prefers diverse non-overlapping suggestions over shifted duplicates', () => {
    const availableSlots = meetingGrid(meeting).slots;
    const result = aggregateAvailability(meeting, [
      {
        displayName: 'Alice',
        availabilities: availableSlots.map((slot) =>
          quarter(slot.datetimeStart, slot.datetimeEnd),
        ),
      },
    ]);

    expect(result.bestTimes.map((slot) => slot.timeLabel)).toEqual([
      '08:00',
      '09:00',
    ]);
  });

  it('ranks stronger matches before weaker non-overlapping options', () => {
    const slots = meetingGrid(meeting).slots;
    const result = aggregateAvailability(meeting, [
      {
        displayName: 'Alice',
        availabilities: slots.map((slot) =>
          quarter(slot.datetimeStart, slot.datetimeEnd),
        ),
      },
      {
        displayName: 'Bob',
        availabilities: slots.slice(4).map((slot) =>
          quarter(slot.datetimeStart, slot.datetimeEnd),
        ),
      },
    ]);

    expect(result.bestTimes.map((slot) => slot.timeLabel)).toEqual([
      '09:00',
      '08:00',
    ]);
    expect(result.bestTimes[0]).toMatchObject({
      availableCount: 2,
      percentage: 100,
    });
    expect(result.bestTimes[1]).toMatchObject({
      availableCount: 1,
      percentage: 50,
    });
  });

  it('prefers a window with stronger quarter-by-quarter attendance when full-duration attendance ties', () => {
    const slots = meetingGrid({
      ...meeting,
      meetingDurationMinutes: 30,
    }).slots;
    const result = aggregateAvailability(
      { ...meeting, meetingDurationMinutes: 30 },
      [
        {
          displayName: 'Alice',
          availabilities: slots.map((slot) =>
            quarter(slot.datetimeStart, slot.datetimeEnd),
          ),
        },
        {
          displayName: 'Bob',
          availabilities: [
            quarter(slots[3].datetimeStart, slots[3].datetimeEnd),
          ],
        },
      ],
    );

    expect(result.bestTimes[0]).toMatchObject({
      timeLabel: '08:30',
      availableCount: 1,
      percentage: 50,
    });
  });

  it('prefers balanced attendance over a single spike when total partial coverage ties', () => {
    const twoDayMeeting = {
      ...meeting,
      endDate: new Date('2026-08-13T00:00:00.000Z'),
      meetingDurationMinutes: 30,
    } satisfies Meeting;
    const slots = meetingGrid(twoDayMeeting).slots;
    const dayOne = slots.filter((slot) => slot.date === '2026-08-12');
    const dayTwo = slots.filter((slot) => slot.date === '2026-08-13');
    const result = aggregateAvailability(twoDayMeeting, [
      {
        displayName: 'Alice',
        availabilities: [dayOne[0], dayOne[1], dayTwo[0], dayTwo[1]].map(
          (slot) => quarter(slot.datetimeStart, slot.datetimeEnd),
        ),
      },
      {
        displayName: 'Bob',
        availabilities: [dayOne[1], dayTwo[0]].map((slot) =>
          quarter(slot.datetimeStart, slot.datetimeEnd),
        ),
      },
      {
        displayName: 'Charlie',
        availabilities: [dayOne[1], dayTwo[1]].map((slot) =>
          quarter(slot.datetimeStart, slot.datetimeEnd),
        ),
      },
    ]);

    expect(result.bestTimes[0]).toMatchObject({
      date: '2026-08-13',
      timeLabel: '08:00',
      availableCount: 1,
      percentage: 33,
    });
  });

  it('aggregates a 31-day grid for 300 participants within the one-second budget', () => {
    const largeMeeting = {
      ...meeting,
      endDate: new Date('2026-09-11T00:00:00.000Z'),
      workdayEnd: '16:00',
    } satisfies Meeting;
    const availableSlots = meetingGrid(largeMeeting).slots.slice(0, 32);
    const participants = Array.from({ length: 300 }, (_, index) => ({
      displayName: `Participant ${index + 1}`,
      availabilities: availableSlots.map((slot) =>
        quarter(slot.datetimeStart, slot.datetimeEnd),
      ),
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
