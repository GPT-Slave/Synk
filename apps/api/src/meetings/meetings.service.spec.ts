/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Meeting } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { MeetingsService } from './meetings.service';

const baseDto = {
  title: '  Project sync  ',
  description: ' Align the team ',
  startDate: '2026-08-12',
  endDate: '2026-08-15',
  workdayStart: '08:00',
  workdayEnd: '20:00',
  slotIntervalMinutes: 60,
  meetingDurationMinutes: 60,
  timezone: 'Africa/Tunis',
};

function savedMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 'meeting-1',
    organizerId: 'user-1',
    title: 'Project sync',
    description: 'Align the team',
    slug: 'a'.repeat(64),
    timezone: 'Africa/Tunis',
    startDate: new Date('2026-08-12T00:00:00.000Z'),
    endDate: new Date('2026-08-15T00:00:00.000Z'),
    workdayStart: '08:00',
    workdayEnd: '20:00',
    slotIntervalMinutes: 60,
    meetingDurationMinutes: 60,
    finalized: false,
    locked: false,
    finalSlotAt: null,
    finalSlotEnd: null,
    createdAt: new Date('2026-08-04T00:00:00.000Z'),
    ...overrides,
  };
}

describe('MeetingsService', () => {
  const transaction = {
    meeting: { update: jest.fn() },
    availability: { deleteMany: jest.fn(), createMany: jest.fn() },
    participant: {
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(transaction)),
    meeting: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    participant: {
      groupBy: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };
  const realtime = {
    availabilityChanged: jest.fn(),
    meetingUpdated: jest.fn(),
    meetingStateChanged: jest.fn(),
    participantRemoved: jest.fn(),
  };
  const service = new MeetingsService(
    prisma as unknown as PrismaService,
    realtime as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a meeting with a 256-bit hexadecimal invitation token', async () => {
    prisma.meeting.create.mockImplementation(({ data }) =>
      Promise.resolve(savedMeeting({ ...data })),
    );

    const result = await service.create('user-1', baseDto);

    expect(result.slug).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.meeting.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizerId: 'user-1',
        title: 'Project sync',
        description: 'Align the team',
      }),
    });
  });

  it('rejects a reversed date range', async () => {
    await expect(
      service.create('user-1', {
        ...baseDto,
        startDate: '2026-08-15',
        endDate: '2026-08-12',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid working hours', async () => {
    await expect(
      service.create('user-1', { ...baseDto, workdayEnd: '08:00' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects working hours that do not align to the slot interval', async () => {
    await expect(
      service.create('user-1', {
        ...baseDto,
        slotIntervalMinutes: 60,
        workdayStart: '08:30',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a duration that cannot align to the selected slots', async () => {
    await expect(
      service.create('user-1', {
        ...baseDto,
        slotIntervalMinutes: 60,
        meetingDurationMinutes: 90,
      }),
    ).rejects.toThrow(
      'Meeting duration must be a multiple of the selected time-slot size.',
    );
  });

  it('accepts meeting durations from 15 minutes through 6 hours', async () => {
    prisma.meeting.create.mockImplementation(({ data }) =>
      Promise.resolve(savedMeeting({ ...data })),
    );

    const shortMeeting = await service.create('user-1', {
      ...baseDto,
      slotIntervalMinutes: 15,
      meetingDurationMinutes: 15,
    });
    const longMeeting = await service.create('user-1', {
      ...baseDto,
      slotIntervalMinutes: 15,
      meetingDurationMinutes: 360,
    });

    expect(shortMeeting.meetingDurationMinutes).toBe(15);
    expect(longMeeting.meetingDurationMinutes).toBe(360);
  });

  it('rejects duration values outside the slider contract', async () => {
    await expect(
      service.create('user-1', {
        ...baseDto,
        slotIntervalMinutes: 15,
        meetingDurationMinutes: 375,
      }),
    ).rejects.toThrow(
      'Meeting duration must be between 15 minutes and 6 hours in 15-minute steps.',
    );
  });

  it('rejects a duration longer than the daily scheduling window', async () => {
    await expect(
      service.create('user-1', {
        ...baseDto,
        workdayStart: '08:00',
        workdayEnd: '09:00',
        meetingDurationMinutes: 120,
      }),
    ).rejects.toThrow(
      'Meeting duration cannot be longer than the daily scheduling window.',
    );
  });

  it('bounds the meeting date range to protect grid performance', async () => {
    await expect(
      service.create('user-1', {
        ...baseDto,
        startDate: '2026-08-01',
        endDate: '2026-09-01',
      }),
    ).rejects.toThrow(
      'Meeting schedules are limited to 31 days and 1,000 time slots.',
    );
  });

  it('bounds the total generated slot count', async () => {
    await expect(
      service.create('user-1', {
        ...baseDto,
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        workdayStart: '00:00',
        workdayEnd: '24:00',
        slotIntervalMinutes: 30,
      }),
    ).rejects.toThrow(
      'Meeting schedules are limited to 31 days and 1,000 time slots.',
    );
  });

  it('paginates meeting summaries without loading participant rows', async () => {
    prisma.meeting.findMany.mockResolvedValue([
      { ...savedMeeting({ id: 'meeting-3' }), _count: { participants: 3 } },
      { ...savedMeeting({ id: 'meeting-2' }), _count: { participants: 2 } },
      { ...savedMeeting({ id: 'meeting-1' }), _count: { participants: 1 } },
    ]);
    prisma.participant.groupBy.mockResolvedValue([
      { meetingId: 'meeting-3', _count: { _all: 2 } },
    ]);

    const result = await service.list('user-1', {
      cursor: 'meeting-4',
      limit: 2,
    });

    expect(prisma.meeting.findMany).toHaveBeenCalledWith({
      where: { organizerId: 'user-1' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
      cursor: { id: 'meeting-4' },
      skip: 1,
      include: { _count: { select: { participants: true } } },
    });
    expect(prisma.participant.groupBy).toHaveBeenCalledWith({
      by: ['meetingId'],
      where: {
        meetingId: { in: ['meeting-3', 'meeting-2'] },
        respondedAt: { not: null },
      },
      _count: { _all: true },
    });
    expect(result).toMatchObject({
      items: [
        { id: 'meeting-3', participantCount: 3, responseCount: 2 },
        { id: 'meeting-2', participantCount: 2, responseCount: 0 },
      ],
      nextCursor: 'meeting-2',
    });
  });

  it('blocks updates after finalization', async () => {
    prisma.meeting.findFirst.mockResolvedValue(
      savedMeeting({ finalized: true }),
    );

    await expect(
      service.update('user-1', 'meeting-1', { title: 'New title' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.meeting.update).not.toHaveBeenCalled();
  });

  it('clears stale responses when the scheduling window changes', async () => {
    prisma.meeting.findFirst.mockResolvedValue(savedMeeting());
    transaction.meeting.update.mockResolvedValue(
      savedMeeting({ workdayEnd: '18:00' }),
    );

    await service.update('user-1', 'meeting-1', {
      workdayEnd: '18:00',
    });

    expect(transaction.availability.deleteMany).toHaveBeenCalledWith({
      where: { participant: { meetingId: 'meeting-1' } },
    });
    expect(transaction.participant.updateMany).toHaveBeenCalledWith({
      where: { meetingId: 'meeting-1' },
      data: { respondedAt: null },
    });
    expect(transaction.meeting.update).toHaveBeenCalledWith({
      where: { id: 'meeting-1' },
      data: expect.objectContaining({ workdayEnd: '18:00' }),
    });
  });

  it('does not reveal meetings owned by another organizer', async () => {
    prisma.meeting.findFirst.mockResolvedValue(null);

    await expect(
      service.detail('other-user', 'meeting-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('loads heatmap inputs with one narrow relation query instead of N+1 reads', async () => {
    prisma.meeting.findFirst.mockResolvedValue({
      ...savedMeeting(),
      participants: [],
    });

    await service.detail('user-1', 'meeting-1');

    expect(prisma.meeting.findFirst).toHaveBeenCalledWith({
      where: { id: 'meeting-1', organizerId: 'user-1' },
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
    expect(prisma.meeting.findFirst).toHaveBeenCalledTimes(1);
  });

  it('deletes only after ownership is verified', async () => {
    prisma.meeting.findFirst.mockResolvedValue(savedMeeting());
    prisma.meeting.delete.mockResolvedValue(savedMeeting());

    await service.remove('user-1', 'meeting-1');

    expect(prisma.meeting.delete).toHaveBeenCalledWith({
      where: { id: 'meeting-1' },
    });
  });

  it('deletes a non-organizer participant only from an owned meeting', async () => {
    prisma.meeting.findFirst.mockResolvedValue(savedMeeting());
    prisma.participant.findFirst.mockResolvedValue({ id: 'participant-1' });
    prisma.participant.delete.mockResolvedValue({ id: 'participant-1' });

    await service.removeParticipant('user-1', 'meeting-1', 'participant-1');

    expect(prisma.participant.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'participant-1',
        meetingId: 'meeting-1',
        organizerId: null,
      },
      select: { id: true },
    });
    expect(prisma.participant.delete).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
    });
    expect(realtime.participantRemoved).toHaveBeenCalledWith({
      meetingId: 'meeting-1',
      participantId: 'participant-1',
    });
  });

  it('does not delete an organizer response or a participant from another meeting', async () => {
    prisma.meeting.findFirst.mockResolvedValue(savedMeeting());
    prisma.participant.findFirst.mockResolvedValue(null);

    await expect(
      service.removeParticipant('user-1', 'meeting-1', 'participant-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.participant.delete).not.toHaveBeenCalled();
  });

  it('finalizes an owned meeting with a contiguous grid window', async () => {
    prisma.meeting.findFirst.mockResolvedValue(savedMeeting());
    prisma.meeting.update.mockResolvedValue(
      savedMeeting({
        finalized: true,
        locked: true,
        finalSlotAt: new Date('2026-08-12T07:00:00.000Z'),
        finalSlotEnd: new Date('2026-08-12T08:00:00.000Z'),
      }),
    );

    const result = await service.finalize('user-1', 'meeting-1', {
      datetimeStart: '2026-08-12T07:00:00.000Z',
      datetimeEnd: '2026-08-12T08:00:00.000Z',
    });

    expect(result).toMatchObject({
      finalized: true,
      locked: true,
      finalSlot: {
        datetimeStart: '2026-08-12T07:00:00.000Z',
        datetimeEnd: '2026-08-12T08:00:00.000Z',
      },
    });
    expect(realtime.meetingStateChanged).toHaveBeenCalledTimes(1);
  });

  it('rejects a final time that is not aligned to the grid', async () => {
    prisma.meeting.findFirst.mockResolvedValue(savedMeeting());

    await expect(
      service.finalize('user-1', 'meeting-1', {
        datetimeStart: '2026-08-12T07:15:00.000Z',
        datetimeEnd: '2026-08-12T08:15:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a final time with the wrong configured duration', async () => {
    prisma.meeting.findFirst.mockResolvedValue(
      savedMeeting({ meetingDurationMinutes: 120 }),
    );

    await expect(
      service.finalize('user-1', 'meeting-1', {
        datetimeStart: '2026-08-12T07:00:00.000Z',
        datetimeEnd: '2026-08-12T08:00:00.000Z',
      }),
    ).rejects.toThrow('The final time must be exactly 120 minutes.');
  });

  it('locks responses independently and re-opens a finalized meeting', async () => {
    prisma.meeting.findFirst
      .mockResolvedValueOnce(savedMeeting())
      .mockResolvedValueOnce(savedMeeting({ finalized: true, locked: true }));
    prisma.meeting.update
      .mockResolvedValueOnce(savedMeeting({ locked: true }))
      .mockResolvedValueOnce(savedMeeting());

    await service.setLocked('user-1', 'meeting-1', true);
    await service.reopen('user-1', 'meeting-1');

    expect(prisma.meeting.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'meeting-1' },
      data: { locked: true },
    });
    expect(prisma.meeting.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'meeting-1' },
      data: {
        finalized: false,
        locked: false,
        finalSlotAt: null,
        finalSlotEnd: null,
      },
    });
  });

  it('treats locked and finalized meetings as closed to responses', () => {
    expect(service.closedReason(savedMeeting({ locked: true }))).toBe(
      'The organizer has paused responses.',
    );
    expect(service.closedReason(savedMeeting({ finalized: true }))).toBe(
      'This meeting has been finalized.',
    );
  });

  it('stores organizer availability as an overlap participant', async () => {
    prisma.meeting.findFirst.mockResolvedValue(savedMeeting());
    transaction.participant.upsert.mockResolvedValue({
      id: 'participant-organizer',
      organizerId: 'user-1',
      displayName: 'Organizer',
      joinedAt: new Date('2026-08-04T00:00:00.000Z'),
    });

    const result = await service.saveOrganizerAvailability(
      { id: 'user-1', email: 'organizer@example.com' },
      'meeting-1',
      {
        slots: [
          {
            datetimeStart: '2026-08-12T07:00:00.000Z',
            datetimeEnd: '2026-08-12T08:00:00.000Z',
          },
        ],
      },
    );

    expect(transaction.participant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          meetingId_organizerId: {
            meetingId: 'meeting-1',
            organizerId: 'user-1',
          },
        },
      }),
    );
    expect(result.participant).toMatchObject({
      displayName: 'You (organizer)',
      isOrganizer: true,
    });
    expect(realtime.availabilityChanged).toHaveBeenCalledTimes(1);
  });

  it('exposes the same heatmap and participant roster on the public invitation', async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      ...savedMeeting({
        startDate: new Date('2026-08-12T00:00:00.000Z'),
        endDate: new Date('2026-08-12T00:00:00.000Z'),
        workdayStart: '08:00',
        workdayEnd: '09:00',
        slotIntervalMinutes: 60,
      }),
      participants: [
        {
          id: 'participant-1',
          displayName: 'Alice',
          organizerId: null,
          respondedAt: new Date('2026-08-12T06:30:00.000Z'),
          availabilities: [
            {
              datetimeStart: new Date('2026-08-12T07:00:00.000Z'),
              datetimeEnd: new Date('2026-08-12T08:00:00.000Z'),
            },
          ],
        },
      ],
    });

    const result = await service.publicMeeting('a'.repeat(64));

    expect(result.participants).toEqual([
      expect.objectContaining({
        id: 'participant-1',
        displayName: 'Alice',
        responded: true,
      }),
    ]);
    expect(result.heatmap[0]).toMatchObject({
      availableCount: 1,
      totalParticipants: 1,
      participantIds: ['participant-1'],
      participantNames: ['Alice'],
    });
  });
});
