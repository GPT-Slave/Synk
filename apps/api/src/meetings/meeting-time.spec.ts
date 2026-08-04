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
  responseDeadline: null,
  createdAt: new Date('2026-08-04T00:00:00.000Z'),
} satisfies Meeting;

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

  it('keeps cached timezone formatters isolated by timezone', () => {
    const utc = meetingGrid({ ...meeting, timezone: 'UTC' });
    const newYork = meetingGrid({ ...meeting, timezone: 'America/New_York' });
    const tunisAgain = meetingGrid(meeting);

    expect(utc.slots[0].datetimeStart).toBe('2026-08-12T08:00:00.000Z');
    expect(newYork.slots[0].datetimeStart).toBe('2026-08-12T12:00:00.000Z');
    expect(tunisAgain.slots[0].datetimeStart).toBe('2026-08-12T07:00:00.000Z');
  });

  it('rejects impossible calendar dates', () => {
    expect(parseDateOnly('2026-02-29')).toBeNull();
    expect(parseDateOnly('2026-02-28')?.toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });
});
