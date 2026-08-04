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
  finalized: false,
  finalSlotAt: null,
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

  it('rejects impossible calendar dates', () => {
    expect(parseDateOnly('2026-02-29')).toBeNull();
    expect(parseDateOnly('2026-02-28')?.toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });
});
