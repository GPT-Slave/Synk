import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { readCookie } from '../auth/cookies';
import { CSRF_COOKIE, CSRF_ERROR_CODE, CSRF_HEADER } from './csrf.constants';
import { CsrfService } from './csrf.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly csrf: CsrfService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

    this.assertAllowedOrigin(request.headers.origin);
    const cookie = readCookie(request.headers.cookie, CSRF_COOKIE);
    const rawHeader = request.headers[CSRF_HEADER];
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!this.csrf.pairMatches(cookie, header)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: CSRF_ERROR_CODE,
        message: 'Security token missing or invalid. Refresh and try again.',
      });
    }
    return true;
  }

  private assertAllowedOrigin(origin: string | undefined): void {
    if (!origin) return;
    const allowed = (this.config.get<string>('CORS_ORIGIN') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!allowed.includes(origin)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: CSRF_ERROR_CODE,
        message: 'Request origin is not allowed.',
      });
    }
  }
}
