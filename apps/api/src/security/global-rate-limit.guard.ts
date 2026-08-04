import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

interface RateLimitEntry {
  count: number;
  resetsAt: number;
}

@Injectable()
export class GlobalRateLimitGuard implements CanActivate {
  private readonly requests = new Map<string, RateLimitEntry>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(config: ConfigService) {
    this.limit = positiveInteger(config.get<string>('GLOBAL_RATE_LIMIT'), 30);
    this.windowMs = positiveInteger(
      config.get<string>('GLOBAL_RATE_WINDOW_MS'),
      60_000,
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    if (request.method.toUpperCase() === 'OPTIONS') return true;
    const response = http.getResponse<Response>();
    const now = Date.now();
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const current = this.requests.get(key);
    const entry =
      !current || current.resetsAt <= now
        ? { count: 0, resetsAt: now + this.windowMs }
        : current;

    entry.count += 1;
    this.requests.set(key, entry);
    const secondsRemaining = Math.max(
      1,
      Math.ceil((entry.resetsAt - now) / 1_000),
    );
    response.setHeader('RateLimit-Limit', String(this.limit));
    response.setHeader(
      'RateLimit-Remaining',
      String(Math.max(0, this.limit - entry.count)),
    );
    response.setHeader('RateLimit-Reset', String(secondsRemaining));

    if (entry.count > this.limit) {
      response.setHeader('Retry-After', String(secondsRemaining));
      throw new HttpException(
        'Too many requests. Please wait a moment and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (this.requests.size > 5_000) this.removeExpired(now);
    return true;
  }

  private removeExpired(now: number): void {
    for (const [key, entry] of this.requests) {
      if (entry.resetsAt <= now) this.requests.delete(key);
    }
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
