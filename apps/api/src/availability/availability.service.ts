import { Injectable } from '@nestjs/common';
import { ParticipantsService } from '../participants/participants.service';
import { PrismaService } from '../prisma/prisma.service';
import { MeetingsRealtimeGateway } from '../realtime/meetings-realtime.gateway';
import type { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { validateAvailabilitySlots } from './availability-validation';

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

    const slots = validateAvailabilitySlots(participant.meeting, dto.slots).map(
      (slot) => ({ participantId: participant.id, ...slot }),
    );

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
