import { BadRequestException } from '@nestjs/common';
import type { Meeting } from '@prisma/client';
import { meetingGrid } from '../meetings/meeting-time';

interface AvailabilitySlotInput {
  datetimeStart: string;
  datetimeEnd: string;
}

export function validateAvailabilitySlots(
  meeting: Meeting,
  inputs: AvailabilitySlotInput[],
) {
  const allowed = new Map(
    meetingGrid(meeting).slots.map((slot) => [
      slot.datetimeStart,
      slot.datetimeEnd,
    ]),
  );
  const seen = new Set<string>();

  return inputs.map((slot) => {
    const start = new Date(slot.datetimeStart);
    const end = new Date(slot.datetimeEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Availability contains an invalid date.');
    }
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    if (allowed.get(startIso) !== endIso || seen.has(startIso)) {
      throw new BadRequestException(
        'Availability contains a duplicate or out-of-range time slot.',
      );
    }
    seen.add(startIso);
    return { datetimeStart: start, datetimeEnd: end };
  });
}
