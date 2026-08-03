import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { SignupDto } from './dto/signup.dto';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  SessionTokens,
} from './auth.types';

@Injectable()
export class AuthService {
  private readonly accessTtlMs: number;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.accessTtlMs = this.parseDuration(
      this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
    );
    this.refreshTtlMs = this.parseDuration(
      this.config.get<string>('JWT_REFRESH_TTL') ?? '7d',
    );
  }

  async signup(dto: SignupDto): Promise<SessionTokens> {
    const email = this.normalizeEmail(dto.email);
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) throw new ConflictException('An account already exists.');

    const rounds = this.config.get<number>('BCRYPT_ROUNDS') ?? 12;
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash },
      });
      return this.createSession(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An account already exists.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<SessionTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) },
    });
    const passwordMatches = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.createSession(user);
  }

  async refresh(refreshToken: string | undefined): Promise<SessionTokens> {
    if (!refreshToken)
      throw new UnauthorizedException('Refresh token missing.');

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    if (payload.type !== 'refresh' || !payload.jti || !payload.sub) {
      throw new UnauthorizedException('Refresh token is invalid.');
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
      include: { user: true },
    });
    if (
      !storedToken ||
      storedToken.userId !== payload.sub ||
      storedToken.expiresAt <= new Date() ||
      storedToken.tokenHash !== this.hashToken(refreshToken)
    ) {
      throw new UnauthorizedException(
        'Refresh token was already used or revoked.',
      );
    }

    const nextSession = await this.buildSession(storedToken.user);
    const deleted = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.refreshToken.deleteMany({
        where: {
          id: storedToken.id,
          tokenHash: storedToken.tokenHash,
          userId: storedToken.userId,
        },
      });
      if (result.count !== 1) return false;

      await transaction.refreshToken.create({
        data: this.refreshTokenRecord(nextSession),
      });
      return true;
    });

    if (!deleted) {
      throw new UnauthorizedException(
        'Refresh token was already used or revoked.',
      );
    }
    return nextSession;
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.refreshToken.deleteMany({
      where: { tokenHash: this.hashToken(refreshToken) },
    });
  }

  private async createSession(user: User): Promise<SessionTokens> {
    const session = await this.buildSession(user);
    await this.prisma.refreshToken.create({
      data: this.refreshTokenRecord(session),
    });
    return session;
  }

  private async buildSession(user: User): Promise<SessionTokens> {
    const refreshTokenId = randomUUID();
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      type: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      jti: refreshTokenId,
      type: 'refresh',
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: Math.floor(this.accessTtlMs / 1000),
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: Math.floor(this.refreshTtlMs / 1000),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      accessTokenMaxAgeMs: this.accessTtlMs,
      refreshTokenMaxAgeMs: this.refreshTtlMs,
      user: { id: user.id, email: user.email },
    };
  }

  private refreshTokenRecord(session: SessionTokens) {
    const payload = this.jwt.decode<RefreshTokenPayload>(session.refreshToken);
    if (!payload?.jti) throw new Error('Unable to decode refresh token.');

    return {
      id: payload.jti,
      tokenHash: this.hashToken(session.refreshToken),
      userId: session.user.id,
      expiresAt: new Date(Date.now() + session.refreshTokenMaxAgeMs),
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private parseDuration(value: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
    if (!match) throw new Error(`Invalid token TTL: ${value}`);

    const amount = Number(match[1]);
    const unit = match[2] as 's' | 'm' | 'h' | 'd';
    const multiplier = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    }[unit];
    return amount * multiplier;
  }
}
