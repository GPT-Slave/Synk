import type { Meeting } from '@prisma/client';

export interface MeetingGridSlot {
  datetimeStart: string;
  datetimeEnd: string;
  date: string;
  timeLabel: string;
}

interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

interface ZonedBoundary {
  minuteOfDay: number;
  instant: Date;
}

const dateLabelFormatter = new Intl.DateTimeFormat('en', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const zonedFormatterByTimezone = new Map<string, Intl.DateTimeFormat>();
const OFFSET_SAMPLE_HOURS = [-48, -24, -6, 0, 6, 24, 48] as const;

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
  const intervalMs = meeting.slotIntervalMinutes * 60_000;
  const seenStarts = new Set<string>();

  while (dateOnly(cursor) <= end) {
    const date = dateOnly(cursor);
    dates.push({
      date,
      label: dateLabelFormatter.format(cursor),
    });

    const possibleOffsets = timezoneOffsetsForDate(date, meeting.timezone);
    const boundaries: ZonedBoundary[] = [];
    for (
      let minute = startMinutes;
      minute <= endMinutes;
      minute += meeting.slotIntervalMinutes
    ) {
      const instant = zonedDateTimeToUtc(
        date,
        minute,
        meeting.timezone,
        possibleOffsets,
      );
      if (instant) boundaries.push({ minuteOfDay: minute, instant });
    }

    for (let index = 0; index + 1 < boundaries.length; index += 1) {
      const start = boundaries[index];
      const finish = boundaries[index + 1];

      // A wall-clock transition must never create a slot with the wrong real
      // duration. Missing spring-forward boundaries can still join across the
      // skipped hour when the elapsed UTC time is exactly one slot interval.
      if (finish.instant.getTime() - start.instant.getTime() !== intervalMs) {
        continue;
      }

      const datetimeStart = start.instant.toISOString();
      if (seenStarts.has(datetimeStart)) continue;
      seenStarts.add(datetimeStart);

      slots.push({
        datetimeStart,
        datetimeEnd: finish.instant.toISOString(),
        date,
        timeLabel: timeLabel(start.minuteOfDay),
      });
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { dates, slots };
}

function zonedDateTimeToUtc(
  date: string,
  minuteOfDay: number,
  timezone: string,
  possibleOffsets: readonly number[],
): Date | null {
  const local = localDateTime(date, minuteOfDay);
  const desired = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
  );
  const candidates = Array.from(
    new Set(possibleOffsets.map((offset) => desired - offset)),
  )
    .filter((candidate) =>
      sameLocalDateTime(zonedParts(new Date(candidate), timezone), local),
    )
    .sort((left, right) => left - right);

  // Nonexistent wall times have no round-tripping candidate. During the
  // fall-back overlap there are two candidates; choosing the earlier one is a
  // deterministic policy and keeps visible wall-clock labels unique.
  return candidates.length > 0 ? new Date(candidates[0]) : null;
}

function timezoneOffsetsForDate(date: string, timezone: string): number[] {
  const localNoon = localDateTime(date, 12 * 60);
  const approximateNoon = Date.UTC(
    localNoon.year,
    localNoon.month - 1,
    localNoon.day,
    localNoon.hour,
    localNoon.minute,
  );

  return Array.from(
    new Set(
      OFFSET_SAMPLE_HOURS.map((sampleHour) =>
        timezoneOffsetAt(
          approximateNoon + sampleHour * 3_600_000,
          timezone,
        ),
      ),
    ),
  );
}

function localDateTime(date: string, minuteOfDay: number): LocalDateTime {
  const [year, month, day] = date.split('-').map(Number);
  const normalized = new Date(
    Date.UTC(year, month - 1, day, 0, minuteOfDay),
  );
  return {
    year: normalized.getUTCFullYear(),
    month: normalized.getUTCMonth() + 1,
    day: normalized.getUTCDate(),
    hour: normalized.getUTCHours(),
    minute: normalized.getUTCMinutes(),
  };
}

function timezoneOffsetAt(value: number, timezone: string): number {
  const parts = zonedParts(new Date(value), timezone);
  const represented = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  return represented - value;
}

function sameLocalDateTime(
  left: LocalDateTime,
  right: LocalDateTime,
): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

function timeLabel(minuteOfDay: number): string {
  const normalized = minuteOfDay % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function zonedParts(value: Date, timezone: string): LocalDateTime {
  let formatter = zonedFormatterByTimezone.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    zonedFormatterByTimezone.set(timezone, formatter);
  }
  const values = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return values as unknown as LocalDateTime;
}
