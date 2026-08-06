import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

@Injectable()
export class CsrfService {
  constructor(private readonly config: ConfigService) {}

  issueToken(): string {
    const nonce = randomBytes(32).toString('base64url');
    return `${nonce}.${this.signature(nonce)}`;
  }

  isValid(token: string | undefined): token is string {
    if (!token || token.length > 256) return false;
    const separator = token.indexOf('.');
    if (separator < 1 || separator === token.length - 1) return false;
    const nonce = token.slice(0, separator);
    const provided = token.slice(separator + 1);
    const expected = this.signature(nonce);
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    return (
      providedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(providedBuffer, expectedBuffer)
    );
  }

  pairMatches(cookie: string | undefined, header: string | undefined): boolean {
    if (!cookie || !header) return false;
    const cookieBuffer = Buffer.from(cookie);
    const headerBuffer = Buffer.from(header);
    return (
      cookieBuffer.length === headerBuffer.length &&
      timingSafeEqual(cookieBuffer, headerBuffer) &&
      this.isValid(cookie)
    );
  }

  cookieOptions(): CookieOptions {
    const secure =
      this.config.get<string>('COOKIE_SECURE') === 'true' ||
      this.config.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: false,
      secure,
      sameSite: secure ? 'none' : 'lax',
      partitioned: secure,
      path: '/',
      maxAge: 24 * 60 * 60 * 1_000,
    };
  }

  private signature(nonce: string): string {
    const secret =
      this.config.get<string>('CSRF_SECRET') ??
      this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    return createHmac('sha256', secret).update(nonce).digest('base64url');
  }
}
