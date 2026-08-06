import { ConfigService } from '@nestjs/config';
import { CsrfService } from './csrf.service';

describe('CsrfService', () => {
  it('issues signed double-submit tokens and rejects tampering', () => {
    const service = new CsrfService(
      new ConfigService({ JWT_REFRESH_SECRET: 'r'.repeat(32) }),
    );
    const token = service.issueToken();

    expect(service.isValid(token)).toBe(true);
    expect(service.pairMatches(token, token)).toBe(true);
    expect(service.isValid(`${token}tampered`)).toBe(false);
    expect(service.pairMatches(token, `${token}tampered`)).toBe(false);
  });

  it('uses a secure cross-site token cookie in production', () => {
    const service = new CsrfService(
      new ConfigService({
        NODE_ENV: 'production',
        JWT_REFRESH_SECRET: 'r'.repeat(32),
      }),
    );

    expect(service.cookieOptions()).toMatchObject({
      httpOnly: false,
      secure: true,
      sameSite: 'none',
      path: '/',
    });
  });

  it('keeps the token cookie lax for local HTTP development', () => {
    const service = new CsrfService(
      new ConfigService({ JWT_REFRESH_SECRET: 'r'.repeat(32) }),
    );

    expect(service.cookieOptions()).toMatchObject({
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
  });
});
