import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Meeting } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type { AuthUser } from '../auth/auth.types';
import { validateAvailabilitySlots } from '../availability/availability-validation';
import type { UpdateAvailabilityDto } from '../availability/dto/update-availability.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MeetingsRealtimeGateway } from '../realtime/meetings-realtime.gateway';
import type { CreateMeetingDto } from './dto/create-meeting.dto';
import type { FinalizeMeetingDto } from './dto/finalize-meeting.dto';
import type { ListMeetingsQueryDto } from './dto/list-meetings-query.dto';
import type { UpdateMeetingDto } from './dto/update-meeting.dto';
import { aggregateAvailability } from './availability-aggregation';
import {
  dateOnly,
  meetingGrid,
  minutesFromTime,
  parseDateOnly,
} from './meeting-time';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: MeetingsRealtimeGateway,
  ) {}

  async create(organizerId: string, dto: CreateMeetingDto) {
    const data = this.validatedData(dto);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const meeting = await this.prisma.meeting.create({
          data: {
            ...data,
            organizerId,
            slug: randomBytes(32).toString('hex'),
          },
        });
        return this.serialize(meeting);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('Unable to generate a unique invitation link.');
  }

  async list(organizerId: string, query: ListMeetingsQueryDto = {}) {
    const limit = query.limit ?? 24;
    const rows = await this.prisma.meeting.findMany({
      where: { organizerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        _count: { select: { participants: true } },
      },
    });
    const meetings = rows.slice(0, limit);
    const responseCounts = meetings.length
      ? await this.prisma.participant.groupBy({
          by: ['meetingId'],
          where: {
            meetingId: { in: meetings.map((meeting) => meeting.id) },
            respondedAt: { not: null },
          },
          _count: { _all: true },
        })
      : [];
    const responsesByMeeting = new Map(
      responseCounts.map((count) => [count.meetingId, count._count._all]),
    );

    return {
      items: meetings.map((meeting) => ({
        ...this.serialize(meeting),
        status: this.status(meeting),
        participantCount: meeting._count.participants,
        responseCount: responsesByMeeting.get(meeting.id) ?? 0,
      })),
      ...(rows.length > limit
        ? { nextCursor: meetings[meetings.length - 1]?.id }
        : {}),
    };
  }

  async detail(organizerId: string, id: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, organizerId },
      include: {
        participants: {
          orderBy: { joinedAt: 'asc' },
          select: {
            id: true,
            displayName: true,
            joinedAt: true,
            organizerId: true,
            respondedAt: true,
            comment: true,
            availabilities: {
              select: { datetimeStart: true, datetimeEnd: true },
            },
          },
        },
      },
    });
    if (!meeting) throw new NotFoundException('Meeting not found.');
    const availability = aggregateAvailability(meeting, meeting.participants);
    const organizerResponse = meeting.participants.find(
      (participant) => participant.organizerId === organizerId,
    );
    const closedReason = this.closedReason(meeting);

    return {
      ...this.serialize(meeting),
      acceptingResponses: !closedReason,
      ...(closedReason ? { closedReason } : {}),
      status: this.status(meeting),
      participantCount: meeting.participants.length,
      responseCount: meeting.participants.filter(
        (participant) => participant.respondedAt,
      ).length,
      participants: meeting.participants.map((participant) => ({
        id: participant.id,
        displayName: participant.displayName,
        joinedAt: participant.joinedAt.toISOString(),
        isOrganizer: Boolean(participant.organizerId),
        responded: Boolean(participant.respondedAt),
        ...(participant.comment ? { comment: participant.comment } : {}),
      })),
      organizerAvailability: organizerResponse
        ? {
            participant: this.serializeParticipant(organizerResponse),
            availabilities: organizerResponse.availabilities.map(
              (availability) => ({
                datetimeStart: availability.datetimeStart.toISOString(),
                datetimeEnd: availability.datetimeEnd.toISOString(),
              }),
            ),
            ...(organizerResponse.comment
              ? { comment: organizerResponse.comment }
              : {}),
          }
        : {
            participant: {
              id: `organizer:${meeting.id}`,
              displayName: 'You (organizer)',
              joinedAt: meeting.createdAt.toISOString(),
              isOrganizer: true,
            },
            availabilities: [],
          },
      ...availability,
    };
  }

  async update(organizerId: string, id: string, dto: UpdateMeetingDto) {
    const meeting = await this.findOwned(organizerId, id);
    if (meeting.finalized) {
      throw new ConflictException('Finalized meetings cannot be edited.');
    }
    const merged = {
      title: dto.title ?? meeting.title,
      description:
        dto.description === undefined
          ? (meeting.description ?? undefined)
          : dto.description,
      startDate: dto.startDate ?? dateOnly(meeting.startDate),
      endDate: dto.endDate ?? dateOnly(meeting.endDate),
      workdayStart: dto.workdayStart ?? meeting.workdayStart,
      workdayEnd: dto.workdayEnd ?? meeting.workdayEnd,
      slotIntervalMinutes:
        dto.slotIntervalMinutes ?? meeting.slotIntervalMinutes,
      meetingDurationMinutes:
        dto.meetingDurationMinutes ?? meeting.meetingDurationMinutes,
      timezone: dto.timezone ?? meeting.timezone,
    };
    const validated = this.validatedData(merged);
    const scheduleChanged =
      dateOnly(validated.startDate) !== dateOnly(meeting.startDate) ||
      dateOnly(validated.endDate) !== dateOnly(meeting.endDate) ||
      validated.workdayStart !== meeting.workdayStart ||
      validated.workdayEnd !== meeting.workdayEnd ||
      validated.slotIntervalMinutes !== meeting.slotIntervalMinutes ||
      validated.timezone !== meeting.timezone;

    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.meeting.update({
        where: { id: meeting.id },
        data: validated,
      });
      if (scheduleChanged) {
        await transaction.availability.deleteMany({
          where: { participant: { meetingId: meeting.id } },
        });
        await transaction.participant.updateMany({
          where: { meetingId: meeting.id },
          data: { respondedAt: null },
        });
      }
      return result;
    });

    this.realtime.meetingUpdated({ meetingId: updated.id });
    return this.serialize(updated);
  }

  async remove(organizerId: string, id: string): Promise<void> {
    const meeting = await this.findOwned(organizerId, id);
    await this.prisma.meeting.delete({ where: { id: meeting.id } });
  }

  async removeParticipant(
    organizerId: string,
    id: string,
    participantId: string,
  ): Promise<void> {
    const meeting = await this.findOwned(organizerId, id);
    const participant = await this.prisma.participant.findFirst({
      where: {
        id: participantId,
        meetingId: meeting.id,
        organizerId: null,
      },
      select: { id: true },
    });
    if (!participant) throw new NotFoundException('Participant not found.');

    await this.prisma.participant.delete({ where: { id: participant.id } });
    this.realtime.participantRemoved({
      meetingId: meeting.id,
      participantId: participant.id,
    });
  }

  async saveOrganizerAvailability(
    user: AuthUser,
    id: string,
    dto: UpdateAvailabilityDto,
  ) {
    const meeting = await this.findOwned(user.id, id);
    const closedReason = this.closedReason(meeting);
    if (closedReason) throw new ConflictException(closedReason);

    const slots = validateAvailabilitySlots(meeting, dto.slots);
    const comment = dto.comment?.trim() || null;
    const result = await this.prisma.$transaction(async (transaction) => {
      const participant = await transaction.participant.upsert({
        where: {
          meetingId_organizerId: {
            meetingId: meeting.id,
            organizerId: user.id,
          },
        },
        create: {
          meetingId: meeting.id,
          organizerId: user.id,
          displayName: 'Organizer',
          displayNameNormalized: `__organizer__:${user.id}`,
        },
        update: {},
      });

      await transaction.availability.deleteMany({
        where: { participantId: participant.id },
      });
      if (slots.length > 0) {
        await transaction.availability.createMany({
          data: slots.map((slot) => ({
            participantId: participant.id,
            ...slot,
          })),
        });
      }
      await transaction.participant.update({
        where: { id: participant.id },
        data: { comment, respondedAt: new Date() },
      });
      return participant;
    });

    const availabilities = slots.map((slot) => ({
      datetimeStart: slot.datetimeStart.toISOString(),
      datetimeEnd: slot.datetimeEnd.toISOString(),
    }));
    this.realtime.availabilityChanged({
      meetingId: meeting.id,
      participantId: result.id,
      displayName: result.displayName,
      availabilities,
      ...(comment ? { comment } : {}),
    });

    return {
      participant: this.serializeParticipant(result),
      availabilities,
      ...(comment ? { comment } : {}),
    };
  }

  async finalize(organizerId: string, id: string, dto: FinalizeMeetingDto) {
    const meeting = await this.findOwned(organizerId, id);
    if (meeting.finalized) {
      throw new ConflictException(
        'Re-open the meeting before choosing a different final time.',
      );
    }
    const finalSlot = this.validateFinalSlot(meeting, dto);
    const updated = await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        finalized: true,
        locked: true,
        finalSlotAt: finalSlot.datetimeStart,
        finalSlotEnd: finalSlot.datetimeEnd,
      },
    });
    this.broadcastMeetingState(updated);
    return this.serialize(updated);
  }

  async setLocked(organizerId: string, id: string, locked: boolean) {
    const meeting = await this.findOwned(organizerId, id);
    if (meeting.finalized) {
      throw new ConflictException(
        'Re-open the finalized meeting before changing its response lock.',
      );
    }
    const updated = await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: { locked },
    });
    this.broadcastMeetingState(updated);
    return this.serialize(updated);
  }

  async reopen(organizerId: string, id: string) {
    const meeting = await this.findOwned(organizerId, id);
    const updated = await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        finalized: false,
        locked: false,
        finalSlotAt: null,
        finalSlotEnd: null,
      },
    });
    this.broadcastMeetingState(updated);
    return this.serialize(updated);
  }

  async publicMeeting(slug: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { slug },
      include: {
        participants: {
          orderBy: { joinedAt: 'asc' },
          select: {
            id: true,
            displayName: true,
            organizerId: true,
            respondedAt: true,
            availabilities: {
              select: { datetimeStart: true, datetimeEnd: true },
            },
          },
        },
      },
    });
    if (!meeting) throw new NotFoundException('Invitation link not found.');
    const closedReason = this.closedReason(meeting);
    const availability = aggregateAvailability(meeting, meeting.participants);
    return {
      ...this.serialize(meeting),
      acceptingResponses: !closedReason,
      ...(closedReason ? { closedReason } : {}),
      participants: meeting.participants.map((participant) => ({
        id: participant.id,
        displayName: participant.organizerId
          ? 'Organizer'
          : participant.displayName,
        ...(participant.organizerId ? { isOrganizer: true } : {}),
        responded: Boolean(participant.respondedAt),
      })),
      ...availability,
    };
  }

  async findBySlug(slug: string): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findUnique({ where: { slug } });
    if (!meeting) throw new NotFoundException('Invitation link not found.');
    return meeting;
  }

  closedReason(meeting: Meeting): string | undefined {
    if (meeting.finalized) return 'This meeting has been finalized.';
    if (meeting.locked) return 'The organizer has paused responses.';
    return undefined;
  }

  private async findOwned(organizerId: string, id: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, organizerId },
    });
    if (!meeting) throw new NotFoundException('Meeting not found.');
    return meeting;
  }

  private validateFinalSlot(meeting: Meeting, dto: FinalizeMeetingDto) {
    const requestedStart = new Date(dto.datetimeStart);
    const requestedEnd = new Date(dto.datetimeEnd);
    if (
      Number.isNaN(requestedStart.getTime()) ||
      Number.isNaN(requestedEnd.getTime()) ||
      requestedEnd <= requestedStart
    ) {
      throw new BadRequestException('Choose a valid meeting time.');
    }
    if (
      requestedEnd.getTime() - requestedStart.getTime() !==
      meeting.meetingDurationMinutes * 60_000
    ) {
      throw new BadRequestException(
        `The final time must be exactly ${meeting.meetingDurationMinutes} minutes.`,
      );
    }

    const endByStart = new Map(
      meetingGrid(meeting).slots.map((slot) => [
        slot.datetimeStart,
        slot.datetimeEnd,
      ]),
    );
    let cursor = requestedStart.toISOString();
    const target = requestedEnd.toISOString();
    let traversed = 0;
    while (cursor < target && traversed <= endByStart.size) {
      const next = endByStart.get(cursor);
      if (!next) {
        throw new BadRequestException(
          'The final time must be a contiguous part of the meeting grid.',
        );
      }
      cursor = next;
      traversed += 1;
    }
    if (cursor !== target) {
      throw new BadRequestException(
        'The final time must align to the meeting grid.',
      );
    }
    return { datetimeStart: requestedStart, datetimeEnd: requestedEnd };
  }

  private broadcastMeetingState(meeting: Meeting) {
    this.realtime.meetingStateChanged({
      meetingId: meeting.id,
      finalized: meeting.finalized,
      locked: meeting.locked,
      ...(meeting.finalSlotAt && meeting.finalSlotEnd
        ? {
            finalSlot: {
              datetimeStart: meeting.finalSlotAt.toISOString(),
              datetimeEnd: meeting.finalSlotEnd.toISOString(),
            },
          }
        : {}),
    });
  }

  private validatedData(dto: CreateMeetingDto) {
    const startDate = parseDateOnly(dto.startDate);
    const endDate = parseDateOnly(dto.endDate);
    if (!startDate || !endDate) {
      throw new BadRequestException('Enter valid start and end dates.');
    }
    if (endDate < startDate) {
      throw new BadRequestException('End date must be on or after start date.');
    }
    const startMinutes = minutesFromTime(dto.workdayStart);
    const endMinutes = minutesFromTime(dto.workdayEnd);
    const slotIntervalMinutes = dto.slotIntervalMinutes ?? 15;
    const meetingDurationMinutes = dto.meetingDurationMinutes ?? 60;
    if (endMinutes <= startMinutes) {
      throw new BadRequestException('Working hours must end after they start.');
    }
    if (
      startMinutes % slotIntervalMinutes !== 0 ||
      endMinutes % slotIntervalMinutes !== 0
    ) {
      throw new BadRequestException(
        `Working hours must align to ${slotIntervalMinutes}-minute slots.`,
      );
    }
    if (meetingDurationMinutes % slotIntervalMinutes !== 0) {
      throw new BadRequestException(
        'Meeting duration must be a multiple of the selected time-slot size.',
      );
    }
    if (
      meetingDurationMinutes < 15 ||
      meetingDurationMinutes > 360 ||
      meetingDurationMinutes % 15 !== 0
    ) {
      throw new BadRequestException(
        'Meeting duration must be between 15 minutes and 6 hours in 15-minute steps.',
      );
    }
    if (meetingDurationMinutes > endMinutes - startMinutes) {
      throw new BadRequestException(
        'Meeting duration cannot be longer than the daily scheduling window.',
      );
    }
    const dayCount =
      Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
    const slotCount =
      dayCount * ((endMinutes - startMinutes) / slotIntervalMinutes);
    if (dayCount > 31 || slotCount > 1_000) {
      throw new BadRequestException(
        'Meeting schedules are limited to 31 days and 1,000 time slots.',
      );
    }

    return {
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      startDate,
      endDate,
      workdayStart: dto.workdayStart,
      workdayEnd: dto.workdayEnd,
      slotIntervalMinutes,
      meetingDurationMinutes,
      timezone: dto.timezone,
    };
  }

  private status(meeting: Meeting): 'upcoming' | 'past' | 'finalized' {
    if (meeting.finalized) return 'finalized';
    return dateOnly(meeting.endDate) < dateOnly(new Date())
      ? 'past'
      : 'upcoming';
  }

  private serialize(meeting: Meeting) {
    return {
      id: meeting.id,
      title: meeting.title,
      ...(meeting.description ? { description: meeting.description } : {}),
      slug: meeting.slug,
      timezone: meeting.timezone,
      startDate: dateOnly(meeting.startDate),
      endDate: dateOnly(meeting.endDate),
      workdayStart: meeting.workdayStart,
      workdayEnd: meeting.workdayEnd,
      slotIntervalMinutes: meeting.slotIntervalMinutes,
      meetingDurationMinutes: meeting.meetingDurationMinutes,
      finalized: meeting.finalized,
      locked: meeting.locked,
      ...(meeting.finalSlotAt && meeting.finalSlotEnd
        ? {
            finalSlot: {
              datetimeStart: meeting.finalSlotAt.toISOString(),
              datetimeEnd: meeting.finalSlotEnd.toISOString(),
            },
          }
        : {}),
      createdAt: meeting.createdAt.toISOString(),
    };
  }

  private serializeParticipant(participant: {
    id: string;
    displayName: string;
    joinedAt: Date;
    organizerId?: string | null;
  }) {
    return {
      id: participant.id,
      displayName: participant.organizerId
        ? 'You (organizer)'
        : participant.displayName,
      joinedAt: participant.joinedAt.toISOString(),
      ...(participant.organizerId ? { isOrganizer: true } : {}),
    };
  }
}
