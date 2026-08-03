import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_RATE_LIMIT_KEY } from '../auth-rate-limit.decorator';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

describe('AuthRateLimitGuard', () => {
  it('blocks requests after the configured limit', () => {
    const handler = () => undefined;
    Reflect.defineMetadata(
      AUTH_RATE_LIMIT_KEY,
      { limit: 2, windowMs: 60_000 },
      handler,
    );
    const response = { setHeader: jest.fn() };
    const context = {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => ({ ip: '127.0.0.1', path: '/auth/login' }),
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    const guard = new AuthRateLimitGuard(new Reflector());

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });
});
