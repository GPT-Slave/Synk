import type { Meeting } from '@prisma/client';

export interface MeetingGridSlot {
  datetimeStart: string;
  datetimeEnd: string;
  date: string;
  timeLabel: string;
}

export function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || dateOnly(date) !== value ? null : date;
}

export function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function meetingGrid(meeting: Meeting) {
  const dates: Array<{ date: string; label: string }> = [];
  const slots: MeetingGridSlot[] = [];
  const cursor = new Date(meeting.startDate);
  const end = dateOnly(meeting.endDate);
  const startMinutes = minutesFromTime(meeting.workdayStart);
  const endMinutes = minutesFromTime(meeting.workdayEnd);

  while (dateOnly(cursor) <= end) {
    const date = dateOnly(cursor);
    dates.push({
      date,
      label: new Intl.DateTimeFormat('en', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(cursor),
    });

    for (
      let minute = startMinutes;
      minute + meeting.slotIntervalMinutes <= endMinutes;
      minute += meeting.slotIntervalMinutes
    ) {
      const hours = Math.floor(minute / 60);
      const minutes = minute % 60;
      const nextMinute = minute + meeting.slotIntervalMinutes;
      const start = zonedDateTimeToUtc(date, hours, minutes, meeting.timezone);
      const finish = zonedDateTimeToUtc(
        date,
        Math.floor(nextMinute / 60),
        nextMinute % 60,
        meeting.timezone,
      );
      slots.push({
        datetimeStart: start.toISOString(),
        datetimeEnd: finish.toISOString(),
        date,
        timeLabel: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { dates, slots };
}

function zonedDateTimeToUtc(
  date: string,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const [year, month, day] = date.split('-').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = desired;

  // Two passes account for daylight-saving offsets around transitions.
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = zonedParts(new Date(candidate), timezone);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );
    candidate += desired - represented;
  }
  return new Date(candidate);
}

function zonedParts(value: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return values as {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  };
}
