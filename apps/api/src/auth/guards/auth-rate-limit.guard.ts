import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import {
  AUTH_RATE_LIMIT_KEY,
  type AuthRateLimitOptions,
} from '../auth-rate-limit.decorator';

interface RateLimitEntry {
  count: number;
  resetsAt: number;
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<string, RateLimitEntry>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<AuthRateLimitOptions>(
      AUTH_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const now = Date.now();
    const key = `${request.ip ?? request.socket.remoteAddress ?? 'unknown'}:${request.path}`;
    const existing = this.attempts.get(key);
    const entry =
      !existing || existing.resetsAt <= now
        ? { count: 0, resetsAt: now + options.windowMs }
        : existing;

    entry.count += 1;
    this.attempts.set(key, entry);

    const secondsRemaining = Math.max(
      1,
      Math.ceil((entry.resetsAt - now) / 1000),
    );
    response.setHeader('X-RateLimit-Limit', String(options.limit));
    response.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(0, options.limit - entry.count)),
    );
    response.setHeader('X-RateLimit-Reset', String(secondsRemaining));

    if (entry.count > options.limit) {
      response.setHeader('Retry-After', String(secondsRemaining));
      throw new HttpException(
        'Too many authentication attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (this.attempts.size > 10_000) this.removeExpiredEntries(now);
    return true;
  }

  private removeExpiredEntries(now: number) {
    for (const [key, entry] of this.attempts) {
      if (entry.resetsAt <= now) this.attempts.delete(key);
    }
  }
}
