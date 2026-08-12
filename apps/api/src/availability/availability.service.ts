import { Injectable } from '@nestjs/common';
import { ParticipantsService } from '../participants/participants.service';
import { PrismaService } from '../prisma/prisma.service';
import { MeetingsRealtimeGateway } from '../realtime/meetings-realtime.gateway';
import {
  availabilitySlotChanges,
  availabilitySlotsEqual,
} from './availability-persistence';
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

    const slots = validateAvailabilitySlots(participant.meeting, dto.slots);
    const comment = dto.comment?.trim() || null;
    const slotsChanged = !availabilitySlotsEqual(
      participant.availabilities,
      slots,
    );
    const participantChanged =
      participant.comment !== comment || participant.respondedAt === null;

    if (slotsChanged || participantChanged) {
      const changes = availabilitySlotChanges(
        participant.availabilities,
        slots,
      );
      await this.prisma.$transaction(async (transaction) => {
        if (changes.deleteIds.length > 0) {
          await transaction.availability.deleteMany({
            where: { id: { in: changes.deleteIds } },
          });
        }
        if (changes.create.length > 0) {
          await transaction.availability.createMany({
            data: changes.create.map((slot) => ({
              participantId: participant.id,
              ...slot,
            })),
            skipDuplicates: true,
          });
        }
        if (participantChanged) {
          await transaction.participant.update({
            where: { id: participant.id },
            data: {
              comment,
              respondedAt: participant.respondedAt ?? new Date(),
            },
          });
        }
      });
    }

    const availabilities = slots.map((slot) => ({
      datetimeStart: slot.datetimeStart.toISOString(),
      datetimeEnd: slot.datetimeEnd.toISOString(),
    }));
    if (slotsChanged || participantChanged) {
      this.realtime.availabilityChanged({
        meetingId: participant.meeting.id,
        participantId: participant.id,
        displayName: participant.displayName,
        availabilities,
        ...(comment ? { comment } : {}),
      });
    }

    return { availabilities, ...(comment ? { comment } : {}) };
  }
}
