import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { CSRF_COOKIE, CSRF_HEADER } from './csrf.constants';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from './csrf.service';

function contextFor(request: Partial<Request>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  const config = new ConfigService({
    CORS_ORIGIN: 'https://synk.example,https://app.synk.example',
    JWT_REFRESH_SECRET: 'r'.repeat(32),
  });
  const csrf = new CsrfService(config);
  const guard = new CsrfGuard(csrf, config);

  it('allows safe requests without a token', () => {
    expect(guard.canActivate(contextFor({ method: 'GET', headers: {} }))).toBe(
      true,
    );
  });

  it('allows an approved origin with a matching signed pair', () => {
    const token = csrf.issueToken();
    expect(
      guard.canActivate(
        contextFor({
          method: 'PATCH',
          headers: {
            origin: 'https://synk.example',
            cookie: `${CSRF_COOKIE}=${token}`,
            [CSRF_HEADER]: token,
          },
        }),
      ),
    ).toBe(true);
  });

  it.each([
    { label: 'missing token', origin: 'https://synk.example' },
    { label: 'hostile origin', origin: 'https://evil.example' },
  ])('rejects a $label on state-changing requests', ({ origin }) => {
    expect(() =>
      guard.canActivate(contextFor({ method: 'POST', headers: { origin } })),
    ).toThrow(ForbiddenException);
  });
});
