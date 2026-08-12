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
  meetingDurationMinutes: 60,
  finalized: false,
  locked: false,
  finalSlotAt: null,
  finalSlotEnd: null,
  createdAt: new Date('2026-08-04T00:00:00.000Z'),
} satisfies Meeting;

const existingParticipant = {
  id: 'participant-1',
  meetingId: meeting.id,
  displayName: 'Alice',
  displayNameNormalized: 'alice',
  sessionTokenHash: null,
  organizerId: null,
  comment: 'Remote is fine',
  respondedAt: new Date('2026-08-04T01:00:00.000Z'),
  joinedAt: new Date('2026-08-04T00:00:00.000Z'),
  availabilities: [
    {
      id: 'availability-1',
      participantId: 'participant-1',
      datetimeStart: new Date('2026-08-12T07:00:00.000Z'),
      datetimeEnd: new Date('2026-08-12T08:00:00.000Z'),
    },
  ],
};

describe('ParticipantsService', () => {
  const transaction = {
    meeting: { findUnique: jest.fn() },
    participant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    participantSession: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(transaction)),
    participant: { findUnique: jest.fn() },
    participantSession: { findUnique: jest.fn(), create: jest.fn() },
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
    transaction.participantSession.create.mockResolvedValue({});
    prisma.participantSession.findUnique.mockResolvedValue(null);
    prisma.participant.findUnique.mockResolvedValue(null);
    prisma.participantSession.create.mockResolvedValue({});
    meetings.closedReason.mockReturnValue(undefined);
    meetings.findBySlug.mockResolvedValue(meeting);
  });

  it('normalizes names and stores only a hash for a new device session', async () => {
    transaction.participant.create.mockImplementation(({ data }) =>
      Promise.resolve({
        ...existingParticipant,
        displayName: data.displayName,
        displayNameNormalized: data.displayNameNormalized,
        comment: null,
        availabilities: [],
      }),
    );

    const result = await service.join(meeting.slug, '  Alice   Dev  ');

    expect(result.participant.displayName).toBe('Alice Dev');
    expect(result.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(transaction.participant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        displayNameNormalized: 'alice dev',
      }),
      include: { availabilities: true },
    });
    expect(transaction.participantSession.create).toHaveBeenCalledWith({
      data: {
        participantId: 'participant-1',
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(
      transaction.participantSession.create.mock.calls[0][0].data.tokenHash,
    ).not.toBe(result.sessionToken);
    expect(realtime.participantJoined).toHaveBeenCalledWith(
      expect.objectContaining({ meetingId: 'meeting-1' }),
    );
  });

  it('reopens an existing participant case-insensitively with saved availability', async () => {
    transaction.participant.findUnique.mockResolvedValue(existingParticipant);

    const result = await service.join(meeting.slug, 'ALICE');

    expect(result.participant).toMatchObject({
      id: 'participant-1',
      displayName: 'Alice',
    });
    expect(result.availabilities).toEqual([
      {
        datetimeStart: '2026-08-12T07:00:00.000Z',
        datetimeEnd: '2026-08-12T08:00:00.000Z',
      },
    ]);
    expect(result.comment).toBe('Remote is fine');
    expect(transaction.participant.create).not.toHaveBeenCalled();
    expect(transaction.participantSession.create).toHaveBeenCalledWith({
      data: {
        participantId: 'participant-1',
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(realtime.participantJoined).not.toHaveBeenCalled();
  });

  it('issues independent session tokens so multiple devices stay signed in', async () => {
    transaction.participant.findUnique.mockResolvedValue(existingParticipant);

    const first = await service.join(meeting.slug, 'Alice');
    const second = await service.join(meeting.slug, 'alice');

    expect(first.sessionToken).not.toBe(second.sessionToken);
    expect(transaction.participantSession.create).toHaveBeenCalledTimes(2);
    expect(transaction.participant.create).not.toHaveBeenCalled();
  });

  it('uses Unicode compatibility normalization when reopening a name', async () => {
    transaction.participant.findUnique.mockResolvedValue(existingParticipant);

    const result = await service.join(meeting.slug, 'Ａlice');

    expect(result.participant.id).toBe('participant-1');
    expect(transaction.participant.findUnique).toHaveBeenCalledWith({
      where: {
        meetingId_displayNameNormalized: {
          meetingId: meeting.id,
          displayNameNormalized: 'alice',
        },
      },
      include: { availabilities: true },
    });
  });

  it('blocks joins when the meeting is locked or finalized', async () => {
    meetings.closedReason.mockReturnValue(
      'The organizer has paused responses.',
    );

    await expect(service.join(meeting.slug, 'Alice')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.participantSession.create).not.toHaveBeenCalled();
  });

  it('loads a participant through a device session token', async () => {
    prisma.participantSession.findUnique.mockResolvedValue({
      participant: { ...existingParticipant, meeting },
    });

    const result = await service.session(meeting.slug, 'device-token');

    expect(result.participant.id).toBe('participant-1');
    expect(result.availabilities).toHaveLength(1);
    expect(prisma.participant.findUnique).not.toHaveBeenCalled();
  });

  it('keeps legacy participant tokens valid during migration', async () => {
    prisma.participant.findUnique.mockResolvedValue({
      ...existingParticipant,
      meeting,
    });

    const result = await service.session(meeting.slug, 'legacy-token');

    expect(result.participant.id).toBe('participant-1');
  });

  it('rejects an invalid returning participant token', async () => {
    await expect(
      service.session(meeting.slug, 'wrong-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
