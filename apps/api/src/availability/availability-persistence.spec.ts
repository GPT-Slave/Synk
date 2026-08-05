import {
  availabilitySlotChanges,
  availabilitySlotsEqual,
} from './availability-persistence';

const slot = (id: string, start: string, end: string) => ({
  id,
  datetimeStart: new Date(start),
  datetimeEnd: new Date(end),
});

describe('availability persistence', () => {
  it('writes only changed quarter-hour slots', () => {
    const existing = [
      slot('slot-1', '2026-08-12T07:00:00.000Z', '2026-08-12T07:15:00.000Z'),
      slot('slot-2', '2026-08-12T07:15:00.000Z', '2026-08-12T07:30:00.000Z'),
    ];
    const desired = [
      {
        datetimeStart: new Date('2026-08-12T07:15:00.000Z'),
        datetimeEnd: new Date('2026-08-12T07:30:00.000Z'),
      },
      {
        datetimeStart: new Date('2026-08-12T07:30:00.000Z'),
        datetimeEnd: new Date('2026-08-12T07:45:00.000Z'),
      },
    ];

    expect(availabilitySlotChanges(existing, desired)).toEqual({
      deleteIds: ['slot-1'],
      create: [desired[1]],
    });
  });

  it('recognizes an unchanged response regardless of slot order', () => {
    const existing = [
      slot('slot-1', '2026-08-12T07:00:00.000Z', '2026-08-12T07:15:00.000Z'),
      slot('slot-2', '2026-08-12T07:15:00.000Z', '2026-08-12T07:30:00.000Z'),
    ];
    const desired = [
      {
        datetimeStart: existing[1].datetimeStart,
        datetimeEnd: existing[1].datetimeEnd,
      },
      {
        datetimeStart: existing[0].datetimeStart,
        datetimeEnd: existing[0].datetimeEnd,
      },
    ];

    expect(availabilitySlotsEqual(existing, desired)).toBe(true);
  });
});
