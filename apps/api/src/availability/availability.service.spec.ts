/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { BadRequestException } from '@nestjs/common';
import type { Meeting } from '@prisma/client';
import type { ParticipantsService } from '../participants/participants.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { MeetingsRealtimeGateway } from '../realtime/meetings-realtime.gateway';
import { AvailabilityService } from './availability.service';

const meeting = {
  id: 'meeting-1',
  organizerId: 'user-1',
  title: 'Planning',
  description: null,
  slug: 'a'.repeat(64),
  timezone: 'Africa/Tunis',
  startDate: new Date('2026-08-12T00:00:00.000Z'),
  endDate: new Date('2026-08-12T00:00:00.000Z'),
  workdayStart: '08:00',
  workdayEnd: '10:00',
  slotIntervalMinutes: 60,
  finalized: false,
  locked: false,
  finalSlotAt: null,
  finalSlotEnd: null,
  responseDeadline: null,
  createdAt: new Date('2026-08-04T00:00:00.000Z'),
} satisfies Meeting;

describe('AvailabilityService', () => {
  const transaction = {
    availability: { deleteMany: jest.fn(), createMany: jest.fn() },
    participant: { update: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(transaction)),
  };
  const participants = {
    requireSession: jest.fn(),
    ensureOpen: jest.fn(),
  };
  const realtime = {
    availabilityChanged: jest.fn(),
  };
  const service = new AvailabilityService(
    prisma as unknown as PrismaService,
    participants as unknown as ParticipantsService,
    realtime as unknown as MeetingsRealtimeGateway,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    participants.requireSession.mockResolvedValue({
      id: 'participant-1',
      displayName: 'Alice',
      meeting,
    });
  });

  it('transactionally replaces availability with exact meeting grid slots', async () => {
    const result = await service.replace(meeting.slug, 'session-token', {
      slots: [
        {
          datetimeStart: '2026-08-12T07:00:00.000Z',
          datetimeEnd: '2026-08-12T08:00:00.000Z',
        },
      ],
    });

    expect(participants.ensureOpen).toHaveBeenCalledWith(meeting);
    expect(transaction.availability.deleteMany).toHaveBeenCalledWith({
      where: { participantId: 'participant-1' },
    });
    expect(transaction.availability.createMany).toHaveBeenCalledTimes(1);
    expect(transaction.participant.update).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: { comment: null, respondedAt: expect.any(Date) },
    });
    expect(realtime.availabilityChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingId: 'meeting-1',
        participantId: 'participant-1',
      }),
    );
    expect(result.availabilities).toEqual([
      {
        datetimeStart: '2026-08-12T07:00:00.000Z',
        datetimeEnd: '2026-08-12T08:00:00.000Z',
      },
    ]);
  });

  it('stores an optional comment with an intentional empty response', async () => {
    const result = await service.replace(meeting.slug, 'session-token', {
      slots: [],
      comment: '  Afternoons are easier.  ',
    });

    expect(transaction.participant.update).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: {
        comment: 'Afternoons are easier.',
        respondedAt: expect.any(Date),
      },
    });
    expect(result).toMatchObject({ comment: 'Afternoons are easier.' });
  });

  it('rejects slots outside meeting dates and working hours', async () => {
    await expect(
      service.replace(meeting.slug, 'session-token', {
        slots: [
          {
            datetimeStart: '2026-08-12T06:00:00.000Z',
            datetimeEnd: '2026-08-12T07:00:00.000Z',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.availability.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects duplicate slots before replacing stored availability', async () => {
    const slot = {
      datetimeStart: '2026-08-12T07:00:00.000Z',
      datetimeEnd: '2026-08-12T08:00:00.000Z',
    };
    await expect(
      service.replace(meeting.slug, 'session-token', { slots: [slot, slot] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.availability.deleteMany).not.toHaveBeenCalled();
  });
});
