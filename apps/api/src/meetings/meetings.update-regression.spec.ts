/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import type { Meeting } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { MeetingsRealtimeGateway } from '../realtime/meetings-realtime.gateway';
import { MeetingsService } from './meetings.service';

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
    slotIntervalMinutes: 15,
    meetingDurationMinutes: 60,
    finalized: false,
    locked: false,
    finalSlotAt: null,
    finalSlotEnd: null,
    createdAt: new Date('2026-08-04T00:00:00.000Z'),
    ...overrides,
  };
}

describe('MeetingsService update regressions', () => {
  const transaction = {
    meeting: { update: jest.fn() },
    availability: { deleteMany: jest.fn() },
    participant: { updateMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(transaction)),
    meeting: { findFirst: jest.fn() },
  };
  const realtime = {
    meetingUpdated: jest.fn(),
  };
  const service = new MeetingsService(
    prisma as unknown as PrismaService,
    realtime as unknown as MeetingsRealtimeGateway,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.meeting.findFirst.mockResolvedValue(savedMeeting());
    transaction.meeting.update.mockImplementation(({ data }) =>
      Promise.resolve(savedMeeting({ ...data })),
    );
  });

  it('saves editable fields without clearing responses when the schedule is unchanged', async () => {
    const result = await service.update('user-1', 'meeting-1', {
      title: 'Updated project sync',
      description: 'Updated agenda',
      startDate: '2026-08-12',
      endDate: '2026-08-15',
      workdayStart: '08:00',
      workdayEnd: '20:00',
      slotIntervalMinutes: 15,
      meetingDurationMinutes: 90,
      timezone: 'Africa/Tunis',
    });

    expect(result).toMatchObject({
      title: 'Updated project sync',
      description: 'Updated agenda',
      meetingDurationMinutes: 90,
    });
    expect(transaction.availability.deleteMany).not.toHaveBeenCalled();
    expect(transaction.participant.updateMany).not.toHaveBeenCalled();
    expect(realtime.meetingUpdated).toHaveBeenCalledTimes(1);
    expect(realtime.meetingUpdated).toHaveBeenCalledWith({
      meetingId: 'meeting-1',
    });
  });

  it('stores an explicitly cleared description as null', async () => {
    const result = await service.update('user-1', 'meeting-1', {
      description: '',
    });

    expect(transaction.meeting.update).toHaveBeenCalledWith({
      where: { id: 'meeting-1' },
      data: expect.objectContaining({ description: null }),
    });
    expect(result).not.toHaveProperty('description');
    expect(transaction.availability.deleteMany).not.toHaveBeenCalled();
    expect(realtime.meetingUpdated).toHaveBeenCalledTimes(1);
  });

  it('still clears stale responses when the actual scheduling grid changes', async () => {
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
    expect(realtime.meetingUpdated).toHaveBeenCalledTimes(1);
  });

  it('does not broadcast an update when the transaction fails', async () => {
    prisma.$transaction.mockRejectedValueOnce(new Error('transaction failed'));

    await expect(
      service.update('user-1', 'meeting-1', {
        title: 'This should roll back',
      }),
    ).rejects.toThrow('transaction failed');

    expect(realtime.meetingUpdated).not.toHaveBeenCalled();
  });
});
