import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Meeting } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMeetingDto } from './dto/create-meeting.dto';
import type { UpdateMeetingDto } from './dto/update-meeting.dto';
import {
  dateOnly,
  meetingGrid,
  minutesFromTime,
  parseDateOnly,
} from './meeting-time';

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async list(organizerId: string) {
    const meetings = await this.prisma.meeting.findMany({
      where: { organizerId },
      orderBy: [{ finalized: 'asc' }, { startDate: 'asc' }],
      include: {
        participants: { select: { availabilities: { select: { id: true } } } },
      },
    });
    return meetings.map((meeting) => ({
      ...this.serialize(meeting),
      status: this.status(meeting),
      participantCount: meeting.participants.length,
      responseCount: meeting.participants.filter(
        (participant) => participant.availabilities.length > 0,
      ).length,
    }));
  }

  async detail(organizerId: string, id: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, organizerId },
      include: {
        participants: {
          orderBy: { joinedAt: 'asc' },
          include: { availabilities: true },
        },
      },
    });
    if (!meeting) throw new NotFoundException('Meeting not found.');

    return {
      ...this.serialize(meeting),
      status: this.status(meeting),
      participantCount: meeting.participants.length,
      responseCount: meeting.participants.filter(
        (participant) => participant.availabilities.length > 0,
      ).length,
      participants: meeting.participants.map((participant) => ({
        id: participant.id,
        displayName: participant.displayName,
        joinedAt: participant.joinedAt.toISOString(),
        responded: participant.availabilities.length > 0,
      })),
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
      timezone: dto.timezone ?? meeting.timezone,
      responseDeadline:
        dto.responseDeadline === undefined
          ? meeting.responseDeadline?.toISOString()
          : dto.responseDeadline,
    };
    const scheduleChanged = Boolean(
      dto.startDate ??
      dto.endDate ??
      dto.workdayStart ??
      dto.workdayEnd ??
      dto.timezone,
    );
    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.meeting.update({
        where: { id: meeting.id },
        data: this.validatedData(merged),
      });
      if (scheduleChanged) {
        await transaction.availability.deleteMany({
          where: { participant: { meetingId: meeting.id } },
        });
      }
      return result;
    });
    return this.serialize(updated);
  }

  async remove(organizerId: string, id: string): Promise<void> {
    const meeting = await this.findOwned(organizerId, id);
    await this.prisma.meeting.delete({ where: { id: meeting.id } });
  }

  async publicMeeting(slug: string) {
    const meeting = await this.findBySlug(slug);
    const closedReason = this.closedReason(meeting);
    return {
      ...this.serialize(meeting),
      acceptingResponses: !closedReason,
      ...(closedReason ? { closedReason } : {}),
      ...meetingGrid(meeting),
    };
  }

  async findBySlug(slug: string): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findUnique({ where: { slug } });
    if (!meeting) throw new NotFoundException('Invitation link not found.');
    return meeting;
  }

  closedReason(meeting: Meeting): string | undefined {
    if (meeting.finalized) return 'This meeting has been finalized.';
    if (meeting.responseDeadline && meeting.responseDeadline <= new Date()) {
      return 'The response deadline has passed.';
    }
    return undefined;
  }

  private async findOwned(organizerId: string, id: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, organizerId },
    });
    if (!meeting) throw new NotFoundException('Meeting not found.');
    return meeting;
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
    if (minutesFromTime(dto.workdayEnd) <= minutesFromTime(dto.workdayStart)) {
      throw new BadRequestException('Working hours must end after they start.');
    }

    return {
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      startDate,
      endDate,
      workdayStart: dto.workdayStart,
      workdayEnd: dto.workdayEnd,
      timezone: dto.timezone,
      responseDeadline: dto.responseDeadline
        ? new Date(dto.responseDeadline)
        : null,
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
      finalized: meeting.finalized,
      ...(meeting.responseDeadline
        ? { responseDeadline: meeting.responseDeadline.toISOString() }
        : {}),
      createdAt: meeting.createdAt.toISOString(),
    };
  }
}
