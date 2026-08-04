import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import {
  ACCESS_TOKEN_COOKIE,
  LEGACY_ACCESS_TOKEN_COOKIE,
  type AccessTokenPayload,
} from '../auth/auth.types';
import { readCookie } from '../auth/cookies';
import { PrismaService } from '../prisma/prisma.service';

const AUTHORIZED_ROOM = 'authorized-organizers';

export interface ParticipantJoinedEvent {
  meetingId: string;
  participant: {
    id: string;
    displayName: string;
    joinedAt: string;
  };
}

export interface AvailabilityChangedEvent {
  meetingId: string;
  participantId: string;
  displayName: string;
  availabilities: Array<{
    datetimeStart: string;
    datetimeEnd: string;
  }>;
  comment?: string;
}

export interface MeetingStateChangedEvent {
  meetingId: string;
  finalized: boolean;
  locked: boolean;
  finalSlot?: {
    datetimeStart: string;
    datetimeEnd: string;
  };
}

@Injectable()
@WebSocketGateway({
  namespace: /^\/meetings\/[A-Za-z0-9_-]+$/,
  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  },
  maxHttpBufferSize: 100_000,
})
export class MeetingsRealtimeGateway implements OnGatewayConnection<Socket> {
  @WebSocketServer()
  private namespace!: Namespace;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const meetingId = client.nsp.name.replace('/meetings/', '');
      const token =
        readCookie(client.handshake.headers.cookie, ACCESS_TOKEN_COOKIE) ??
        readCookie(client.handshake.headers.cookie, LEGACY_ACCESS_TOKEN_COOKIE);
      if (!token || !meetingId) throw new Error('Authentication required');

      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      if (payload.type !== 'access' || !payload.sub) {
        throw new Error('Invalid access token');
      }

      const meeting = await this.prisma.meeting.findFirst({
        where: { id: meetingId, organizerId: payload.sub },
        select: { id: true },
      });
      if (!meeting) throw new Error('Meeting not found');

      await client.join(AUTHORIZED_ROOM);
      client.emit('meeting:ready', { meetingId });
    } catch {
      client.emit('meeting:error', { message: 'Organizer access required.' });
      client.disconnect(true);
    }
  }

  participantJoined(event: ParticipantJoinedEvent): void {
    this.child(event.meetingId)
      .to(AUTHORIZED_ROOM)
      .emit('participant:joined', event);
  }

  availabilityChanged(event: AvailabilityChangedEvent): void {
    this.child(event.meetingId)
      .to(AUTHORIZED_ROOM)
      .emit('availability:changed', event);
  }

  meetingStateChanged(event: MeetingStateChangedEvent): void {
    this.child(event.meetingId)
      .to(AUTHORIZED_ROOM)
      .emit('meeting:state-changed', event);
  }

  private child(meetingId: string): Namespace {
    return this.namespace.server.of(`/meetings/${meetingId}`);
  }
}
