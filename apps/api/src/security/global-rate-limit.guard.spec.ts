import { HttpException, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { GlobalRateLimitGuard } from './global-rate-limit.guard';

function contextFor(
  request: Partial<Request>,
  response: Pick<Response, 'setHeader'>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

describe('GlobalRateLimitGuard', () => {
  it('returns standard limit headers and rejects requests over the limit', () => {
    const guard = new GlobalRateLimitGuard(
      new ConfigService({
        GLOBAL_RATE_LIMIT: '2',
        GLOBAL_READ_RATE_LIMIT: '2',
        GLOBAL_RATE_WINDOW_MS: '60000',
      }),
    );
    const response = { setHeader: jest.fn() };
    const context = contextFor(
      {
        method: 'GET',
        ip: '203.0.113.7',
        headers: {},
      },
      response,
    );

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    expect(response.setHeader).toHaveBeenCalledWith('RateLimit-Limit', '2');
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('keeps participants behind the same public IP in separate buckets', () => {
    const guard = new GlobalRateLimitGuard(
      new ConfigService({ GLOBAL_RATE_LIMIT: '1' }),
    );
    const response = { setHeader: jest.fn() };
    const request = (session: string) =>
      contextFor(
        {
          method: 'PUT',
          ip: '203.0.113.7',
          headers: { 'x-participant-session': session },
        },
        response,
      );

    expect(guard.canActivate(request('session-a'))).toBe(true);
    expect(guard.canActivate(request('session-b'))).toBe(true);
    expect(() => guard.canActivate(request('session-a'))).toThrow(
      HttpException,
    );
  });

  it('does not rate limit CORS preflight requests', () => {
    const guard = new GlobalRateLimitGuard(new ConfigService());
    const response = { setHeader: jest.fn() };

    expect(
      guard.canActivate(
        contextFor(
          { method: 'OPTIONS' },
          response as unknown as Pick<Response, 'setHeader'>,
        ),
      ),
    ).toBe(true);
    expect(response.setHeader).not.toHaveBeenCalled();
  });
});
