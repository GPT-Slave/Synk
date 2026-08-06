/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const user: User = {
    id: 'user-1',
    email: 'organizer@example.com',
    passwordHash: '',
    createdAt: new Date('2026-08-04T00:00:00Z'),
  };

  function createFixture() {
    const transactionClient = {
      user: {
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((callback: (client: unknown) => unknown) =>
        callback(transactionClient),
      ),
    };
    const config = new ConfigService({
      JWT_SECRET: 'access-secret-for-tests',
      JWT_REFRESH_SECRET: 'refresh-secret-for-tests',
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '7d',
      BCRYPT_ROUNDS: '4',
    });
    const service = new AuthService(
      prisma as unknown as PrismaService,
      new JwtService(),
      config,
    );

    return { prisma, service, transactionClient };
  }

  it('normalizes email, hashes the password, and stores a refresh token', async () => {
    const { prisma, service, transactionClient } = createFixture();
    prisma.user.findUnique.mockResolvedValue(null);
    transactionClient.user.create.mockImplementation(({ data }) => ({
      ...user,
      ...data,
    }));

    const session = await service.signup({
      email: '  Organizer@Example.COM ',
      password: 'Strong!Pass1',
    });

    const createData = transactionClient.user.create.mock.calls[0][0].data;
    expect(createData.email).toBe('organizer@example.com');
    expect(createData.passwordHash).not.toBe('Strong!Pass1');
    await expect(
      bcrypt.compare('Strong!Pass1', createData.passwordHash),
    ).resolves.toBe(true);
    expect(transactionClient.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(session.user).toEqual({
      id: user.id,
      email: 'organizer@example.com',
    });
  });

  it('uses a generic error for invalid credentials', async () => {
    const { prisma, service } = createFixture();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates a refresh token and deletes the previous token atomically', async () => {
    const { prisma, service, transactionClient } = createFixture();
    prisma.user.findUnique.mockResolvedValue(null);
    transactionClient.user.create.mockResolvedValue(user);

    const firstSession = await service.signup({
      email: user.email,
      password: 'Strong!Pass1',
    });
    const storedRecord =
      transactionClient.refreshToken.create.mock.calls[0][0].data;
    prisma.refreshToken.findUnique.mockResolvedValue({
      ...storedRecord,
      user,
    });
    transactionClient.refreshToken.create.mockClear();

    const nextSession = await service.refresh(firstSession.refreshToken);

    expect(nextSession.refreshToken).not.toBe(firstSession.refreshToken);
    expect(transactionClient.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: {
        id: storedRecord.id,
        tokenHash: storedRecord.tokenHash,
        userId: storedRecord.userId,
      },
    });
    expect(transactionClient.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('invalidates the stored refresh token during logout', async () => {
    const { prisma, service } = createFixture();
    await service.logout('refresh-token');

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
  });
});
