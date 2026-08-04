import { BadRequestException, Injectable } from '@nestjs/common';
import { meetingGrid } from '../meetings/meeting-time';
import { ParticipantsService } from '../participants/participants.service';
import { PrismaService } from '../prisma/prisma.service';
import { MeetingsRealtimeGateway } from '../realtime/meetings-realtime.gateway';
import type { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly participants: ParticipantsService,
    private readonly realtime: MeetingsRealtimeGateway,
  ) {}

  async replace(
    slug: string,
    sessionToken: string | undefined,
    dto: UpdateAvailabilityDto,
  ) {
    const participant = await this.participants.requireSession(
      slug,
      sessionToken,
    );
    this.participants.ensureOpen(participant.meeting);

    const allowed = new Map(
      meetingGrid(participant.meeting).slots.map((slot) => [
        slot.datetimeStart,
        slot.datetimeEnd,
      ]),
    );
    const seen = new Set<string>();
    const slots = dto.slots.map((slot) => {
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
      return {
        participantId: participant.id,
        datetimeStart: start,
        datetimeEnd: end,
      };
    });

    const comment = dto.comment?.trim() || null;
    await this.prisma.$transaction(async (transaction) => {
      await transaction.availability.deleteMany({
        where: { participantId: participant.id },
      });
      if (slots.length > 0) {
        await transaction.availability.createMany({ data: slots });
      }
      await transaction.participant.update({
        where: { id: participant.id },
        data: { comment, respondedAt: new Date() },
      });
    });

    const availabilities = slots.map((slot) => ({
      datetimeStart: slot.datetimeStart.toISOString(),
      datetimeEnd: slot.datetimeEnd.toISOString(),
    }));
    this.realtime.availabilityChanged({
      meetingId: participant.meeting.id,
      participantId: participant.id,
      displayName: participant.displayName,
      availabilities,
      ...(comment ? { comment } : {}),
    });

    return { availabilities, ...(comment ? { comment } : {}) };
  }
}
