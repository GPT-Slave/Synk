import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const jwt = new JwtService();
  const config = new ConfigService({ JWT_SECRET: 'test-access-secret' });

  function context(cookie?: string) {
    const request = { headers: { cookie } };
    return {
      request,
      executionContext: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext,
    };
  }

  it('reads the access cookie and exposes the current user', async () => {
    const token = await jwt.signAsync(
      { sub: 'user-1', email: 'organizer@example.com', type: 'access' },
      { secret: 'test-access-secret', expiresIn: 60 },
    );
    const { request, executionContext } = context(`synk_access=${token}`);
    const guard = new JwtAuthGuard(jwt, config);

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect((request as { user?: unknown }).user).toEqual({
      id: 'user-1',
      email: 'organizer@example.com',
    });
  });

  it('rejects a missing access token', async () => {
    const guard = new JwtAuthGuard(jwt, config);
    const { executionContext } = context();

    await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
