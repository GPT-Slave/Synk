import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type Meeting } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { MeetingsService } from '../meetings/meetings.service';
import { PrismaService } from '../prisma/prisma.service';
import { MeetingsRealtimeGateway } from '../realtime/meetings-realtime.gateway';

@Injectable()
export class ParticipantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meetings: MeetingsService,
    private readonly realtime: MeetingsRealtimeGateway,
  ) {}

  async join(slug: string, requestedName: string) {
    const displayName = requestedName.trim().replace(/\s+/g, ' ');
    if (displayName.length < 2 || displayName.length > 30) {
      throw new ConflictException('Display name must be 2–30 characters.');
    }
    const displayNameNormalized = this.normalizeName(displayName);
    const sessionToken = randomBytes(32).toString('base64url');

    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        const meeting = await transaction.meeting.findUnique({
          where: { slug },
        });
        if (!meeting) throw new NotFoundException('Invitation link not found.');
        this.ensureOpen(meeting);

        const taken = await transaction.participant.findUnique({
          where: {
            meetingId_displayNameNormalized: {
              meetingId: meeting.id,
              displayNameNormalized,
            },
          },
        });
        if (taken) {
          throw new ConflictException({
            message: 'That name is already taken for this meeting.',
            code: 'NAME_TAKEN',
            suggestions: await this.suggestions(
              transaction,
              meeting.id,
              displayName,
            ),
          });
        }

        const participant = await transaction.participant.create({
          data: {
            meetingId: meeting.id,
            displayName,
            displayNameNormalized,
            sessionTokenHash: this.hashToken(sessionToken),
          },
        });
        return { meetingId: meeting.id, participant };
      });

      this.realtime.participantJoined({
        meetingId: result.meetingId,
        participant: this.serialize(result.participant),
      });

      return {
        participant: this.serialize(result.participant),
        sessionToken,
        availabilities: [],
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const meeting = await this.meetings.findBySlug(slug);
        throw new ConflictException({
          message: 'That name is already taken for this meeting.',
          code: 'NAME_TAKEN',
          suggestions: await this.suggestions(
            this.prisma,
            meeting.id,
            displayName,
          ),
        });
      }
      throw error;
    }
  }

  async session(slug: string, sessionToken: string | undefined) {
    const participant = await this.requireSession(slug, sessionToken);
    return {
      participant: this.serialize(participant),
      availabilities: participant.availabilities.map((availability) => ({
        datetimeStart: availability.datetimeStart.toISOString(),
        datetimeEnd: availability.datetimeEnd.toISOString(),
      })),
      ...(participant.comment ? { comment: participant.comment } : {}),
    };
  }

  async requireSession(slug: string, sessionToken: string | undefined) {
    if (!sessionToken) {
      throw new UnauthorizedException('Participant session missing.');
    }
    const participant = await this.prisma.participant.findUnique({
      where: { sessionTokenHash: this.hashToken(sessionToken) },
      include: { meeting: true, availabilities: true },
    });
    if (!participant || participant.meeting.slug !== slug) {
      throw new UnauthorizedException('Participant session is invalid.');
    }
    return participant;
  }

  ensureOpen(meeting: Meeting): void {
    const reason = this.meetings.closedReason(meeting);
    if (reason) throw new ConflictException(reason);
  }

  private async suggestions(
    database: Prisma.TransactionClient | PrismaService,
    meetingId: string,
    displayName: string,
  ) {
    const candidates = [
      `${displayName} 2`,
      `${displayName} Team`,
      `${displayName}-Dev`,
    ].map((candidate) => candidate.slice(0, 30));
    const normalized = candidates.map((candidate) =>
      this.normalizeName(candidate),
    );
    const existing = await database.participant.findMany({
      where: {
        meetingId,
        displayNameNormalized: { in: normalized },
      },
      select: { displayNameNormalized: true },
    });
    const unavailable = new Set(
      existing.map((participant) => participant.displayNameNormalized),
    );
    return candidates.filter(
      (candidate) => !unavailable.has(this.normalizeName(candidate)),
    );
  }

  private normalizeName(displayName: string): string {
    return displayName.normalize('NFKC').toLocaleLowerCase('en-US');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private serialize(participant: {
    id: string;
    displayName: string;
    joinedAt: Date;
  }) {
    return {
      id: participant.id,
      displayName: participant.displayName,
      joinedAt: participant.joinedAt.toISOString(),
    };
  }
}
