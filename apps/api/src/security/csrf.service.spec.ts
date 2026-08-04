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

  it('marks the token cookie secure in production', () => {
    const service = new CsrfService(
      new ConfigService({
        NODE_ENV: 'production',
        JWT_REFRESH_SECRET: 'r'.repeat(32),
      }),
    );

    expect(service.cookieOptions()).toMatchObject({
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
  });
});
