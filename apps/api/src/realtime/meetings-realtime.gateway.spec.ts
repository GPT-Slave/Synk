/* eslint-disable @typescript-eslint/unbound-method */
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import type { PrismaService } from '../prisma/prisma.service';
import { MeetingsRealtimeGateway } from './meetings-realtime.gateway';

describe('MeetingsRealtimeGateway', () => {
  const prisma = {
    meeting: { findFirst: jest.fn() },
  };
  const jwt = { verifyAsync: jest.fn() };
  const config = { getOrThrow: jest.fn(() => 'jwt-secret') };
  const gateway = new MeetingsRealtimeGateway(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
  );

  function socket(cookie = 'synk_access=access-token') {
    return {
      nsp: { name: '/meetings/meeting-1' },
      handshake: { headers: { cookie } },
      data: {},
      join: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as Socket;
  }

  beforeEach(() => jest.clearAllMocks());

  it('authorizes only the organizer who owns the meeting namespace', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'organizer@example.com',
      type: 'access',
    });
    prisma.meeting.findFirst.mockResolvedValue({ id: 'meeting-1' });
    const client = socket();

    await gateway.handleConnection(client);

    expect(prisma.meeting.findFirst).toHaveBeenCalledWith({
      where: { id: 'meeting-1', organizerId: 'user-1' },
      select: { id: true },
    });
    expect(client.join).toHaveBeenCalledWith('authorized-organizers');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects a socket without a valid organizer session', async () => {
    const client = socket('');

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
});
