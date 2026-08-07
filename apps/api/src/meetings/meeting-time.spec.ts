import type { Meeting } from '@prisma/client';
import { meetingGrid, parseDateOnly } from './meeting-time';

const meeting = {
  id: 'meeting-1',
  organizerId: 'user-1',
  title: 'Planning',
  description: null,
  slug: 'a'.repeat(64),
  timezone: 'Africa/Tunis',
  startDate: new Date('2026-08-12T00:00:00.000Z'),
  endDate: new Date('2026-08-13T00:00:00.000Z'),
  workdayStart: '08:00',
  workdayEnd: '10:00',
  slotIntervalMinutes: 60,
  meetingDurationMinutes: 60,
  finalized: false,
  locked: false,
  finalSlotAt: null,
  finalSlotEnd: null,
  createdAt: new Date('2026-08-04T00:00:00.000Z'),
} satisfies Meeting;

function expectSafeSlots(
  slots: ReturnType<typeof meetingGrid>['slots'],
  intervalMinutes: number,
) {
  const starts = slots.map((slot) => slot.datetimeStart);
  expect(new Set(starts).size).toBe(starts.length);

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    expect(
      new Date(slot.datetimeEnd).getTime() -
        new Date(slot.datetimeStart).getTime(),
    ).toBe(intervalMinutes * 60_000);
    if (index > 0) {
      expect(new Date(slot.datetimeStart).getTime()).toBeGreaterThan(
        new Date(slots[index - 1].datetimeStart).getTime(),
      );
    }
  }
}

describe('meetingGrid', () => {
  it('creates hourly slots for every date in the meeting timezone', () => {
    const grid = meetingGrid(meeting);

    expect(grid.dates).toHaveLength(2);
    expect(grid.slots).toHaveLength(4);
    expect(grid.slots[0]).toMatchObject({
      date: '2026-08-12',
      timeLabel: '08:00',
      datetimeStart: '2026-08-12T07:00:00.000Z',
      datetimeEnd: '2026-08-12T08:00:00.000Z',
    });
  });

  it('creates half-hour slots when the meeting requests them', () => {
    const grid = meetingGrid({ ...meeting, slotIntervalMinutes: 30 });

    expect(grid.slots).toHaveLength(8);
    expect(grid.slots[1]).toMatchObject({
      timeLabel: '08:30',
      datetimeStart: '2026-08-12T07:30:00.000Z',
      datetimeEnd: '2026-08-12T08:00:00.000Z',
    });
  });

  it('creates quarter-hour slots for 15-minute meetings', () => {
    const grid = meetingGrid({
      ...meeting,
      slotIntervalMinutes: 15,
      meetingDurationMinutes: 15,
    });

    expect(grid.slots).toHaveLength(16);
    expect(grid.slots[1]).toMatchObject({
      timeLabel: '08:15',
      datetimeStart: '2026-08-12T07:15:00.000Z',
      datetimeEnd: '2026-08-12T07:30:00.000Z',
    });
  });

  it('keeps cached timezone formatters isolated by timezone', () => {
    const utc = meetingGrid({ ...meeting, timezone: 'UTC' });
    const newYork = meetingGrid({ ...meeting, timezone: 'America/New_York' });
    const tunisAgain = meetingGrid(meeting);

    expect(utc.slots[0].datetimeStart).toBe('2026-08-12T08:00:00.000Z');
    expect(newYork.slots[0].datetimeStart).toBe('2026-08-12T12:00:00.000Z');
    expect(tunisAgain.slots[0].datetimeStart).toBe('2026-08-12T07:00:00.000Z');
  });

  it('skips nonexistent spring-forward wall times without duplicating UTC slots', () => {
    const grid = meetingGrid({
      ...meeting,
      timezone: 'Europe/Paris',
      startDate: new Date('2026-03-29T00:00:00.000Z'),
      endDate: new Date('2026-03-29T00:00:00.000Z'),
      workdayStart: '01:00',
      workdayEnd: '04:00',
      slotIntervalMinutes: 15,
      meetingDurationMinutes: 60,
    });

    expect(grid.slots).toHaveLength(8);
    expect(grid.slots.some((slot) => slot.timeLabel.startsWith('02:'))).toBe(
      false,
    );
    expect(grid.slots.find((slot) => slot.timeLabel === '01:45')).toMatchObject(
      {
        datetimeStart: '2026-03-29T00:45:00.000Z',
        datetimeEnd: '2026-03-29T01:00:00.000Z',
      },
    );
    expectSafeSlots(grid.slots, 15);
  });

  it('uses the earlier fall-back occurrence without creating a long fake slot', () => {
    const grid = meetingGrid({
      ...meeting,
      timezone: 'Europe/Paris',
      startDate: new Date('2026-10-25T00:00:00.000Z'),
      endDate: new Date('2026-10-25T00:00:00.000Z'),
      workdayStart: '01:00',
      workdayEnd: '04:00',
      slotIntervalMinutes: 15,
      meetingDurationMinutes: 60,
    });

    expect(grid.slots).toHaveLength(11);
    expect(grid.slots.find((slot) => slot.timeLabel === '02:00')).toMatchObject(
      {
        datetimeStart: '2026-10-25T00:00:00.000Z',
      },
    );
    expect(grid.slots.some((slot) => slot.timeLabel === '02:45')).toBe(false);
    expect(new Set(grid.slots.map((slot) => slot.timeLabel)).size).toBe(
      grid.slots.length,
    );
    expectSafeSlots(grid.slots, 15);
  });

  it('normalizes a 24:00 boundary to midnight on the following day', () => {
    const grid = meetingGrid({
      ...meeting,
      startDate: new Date('2026-08-12T00:00:00.000Z'),
      endDate: new Date('2026-08-12T00:00:00.000Z'),
      workdayStart: '23:00',
      workdayEnd: '24:00',
      slotIntervalMinutes: 15,
      meetingDurationMinutes: 60,
    });

    expect(grid.slots).toHaveLength(4);
    expect(grid.slots.at(-1)).toMatchObject({
      timeLabel: '23:45',
      datetimeEnd: '2026-08-12T23:00:00.000Z',
    });
    expectSafeSlots(grid.slots, 15);
  });

  it('rejects impossible calendar dates', () => {
    expect(parseDateOnly('2026-02-29')).toBeNull();
    expect(parseDateOnly('2026-02-28')?.toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });
});
