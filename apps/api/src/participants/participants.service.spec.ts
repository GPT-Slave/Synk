/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { Meeting } from '@prisma/client';
import type { MeetingsService } from '../meetings/meetings.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { MeetingsRealtimeGateway } from '../realtime/meetings-realtime.gateway';
import { ParticipantsService } from './participants.service';

const meeting = {
  id: 'meeting-1',
  organizerId: 'user-1',
  title: 'Planning',
  description: null,
  slug: 'a'.repeat(64),
  timezone: 'Africa/Tunis',
  startDate: new Date('2026-08-12T00:00:00.000Z'),
  endDate: new Date('2026-08-13T00:00:00.000Z'),
  workdayStart: '08:00',
  workdayEnd: '10:00',
  slotIntervalMinutes: 60,
  finalized: false,
  finalSlotAt: null,
  responseDeadline: null,
  createdAt: new Date('2026-08-04T00:00:00.000Z'),
} satisfies Meeting;

describe('ParticipantsService', () => {
  const transaction = {
    meeting: { findUnique: jest.fn() },
    participant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(transaction)),
    participant: { findUnique: jest.fn(), findMany: jest.fn() },
  };
  const meetings = {
    closedReason: jest.fn(),
    findBySlug: jest.fn(),
  };
  const realtime = { participantJoined: jest.fn() };
  const service = new ParticipantsService(
    prisma as unknown as PrismaService,
    meetings as unknown as MeetingsService,
    realtime as unknown as MeetingsRealtimeGateway,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.meeting.findUnique.mockResolvedValue(meeting);
    transaction.participant.findUnique.mockResolvedValue(null);
    transaction.participant.findMany.mockResolvedValue([]);
    meetings.closedReason.mockReturnValue(undefined);
  });

  it('normalizes names and returns a non-persisted participant session token', async () => {
    transaction.participant.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'participant-1',
        meetingId: meeting.id,
        displayName: data.displayName,
        joinedAt: new Date('2026-08-04T00:00:00.000Z'),
      }),
    );

    const result = await service.join(meeting.slug, '  Alice   Dev  ');

    expect(result.participant.displayName).toBe('Alice Dev');
    expect(result.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(transaction.participant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        displayNameNormalized: 'alice dev',
        sessionTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
    expect(
      transaction.participant.create.mock.calls[0][0].data.sessionTokenHash,
    ).not.toBe(result.sessionToken);
    expect(realtime.participantJoined).toHaveBeenCalledWith(
      expect.objectContaining({ meetingId: 'meeting-1' }),
    );
  });

  it('enforces case-insensitive uniqueness and returns suggestions', async () => {
    transaction.participant.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(service.join(meeting.slug, 'ALICE')).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'NAME_TAKEN',
        suggestions: ['ALICE 2', 'ALICE Team', 'ALICE-Dev'],
      }),
    });
  });

  it('blocks joins after the response deadline or finalization', async () => {
    meetings.closedReason.mockReturnValue('The response deadline has passed.');

    await expect(service.join(meeting.slug, 'Alice')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.participant.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid returning participant token', async () => {
    prisma.participant.findUnique.mockResolvedValue(null);

    await expect(
      service.session(meeting.slug, 'wrong-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
