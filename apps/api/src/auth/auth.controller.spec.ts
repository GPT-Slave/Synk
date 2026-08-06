import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

describe('AuthController', () => {
  it('sets secure cross-site httpOnly access and refresh cookies in production', async () => {
    const session = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenMaxAgeMs: 900_000,
      refreshTokenMaxAgeMs: 604_800_000,
      user: { id: 'user-1', email: 'organizer@example.com' },
    };
    const auth = {
      login: jest.fn().mockResolvedValue(session),
    } as unknown as AuthService;
    const cookie = jest.fn();
    const response = { cookie } as unknown as Response;
    const controller = new AuthController(
      auth,
      new ConfigService({ NODE_ENV: 'production' }),
    );

    await controller.login(
      { email: session.user.email, password: 'Strong!Pass1' },
      response,
    );

    expect(cookie).toHaveBeenNthCalledWith(
      1,
      'synk_access',
      session.accessToken,
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
      }),
    );
    expect(cookie).toHaveBeenNthCalledWith(
      2,
      'synk_refresh',
      session.refreshToken,
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/auth',
      }),
    );
  });
});
