import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { readCookie } from '../auth/cookies';
import {
  ACCESS_TOKEN_COOKIE,
  LEGACY_ACCESS_TOKEN_COOKIE,
} from '../auth/auth.types';
import { CSRF_COOKIE } from './csrf.constants';

interface RateLimitEntry {
  count: number;
  resetsAt: number;
}

@Injectable()
export class GlobalRateLimitGuard implements CanActivate {
  private readonly requests = new Map<string, RateLimitEntry>();
  private readonly limit: number;
  private readonly readLimit: number;
  private readonly windowMs: number;
  private nextCleanupAt = 0;

  constructor(config: ConfigService) {
    this.limit = positiveInteger(config.get<string>('GLOBAL_RATE_LIMIT'), 30);
    this.readLimit = positiveInteger(
      config.get<string>('GLOBAL_READ_RATE_LIMIT'),
      Math.max(this.limit, 120),
    );
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
    if (now >= this.nextCleanupAt) {
      this.removeExpired(now);
      this.nextCleanupAt = now + this.windowMs;
    }

    const readRequest = ['GET', 'HEAD'].includes(request.method.toUpperCase());
    const limit = readRequest ? this.readLimit : this.limit;
    const key = `${readRequest ? 'read' : 'write'}:${this.clientKey(request)}`;
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
    response.setHeader('RateLimit-Limit', String(limit));
    response.setHeader(
      'RateLimit-Remaining',
      String(Math.max(0, limit - entry.count)),
    );
    response.setHeader('RateLimit-Reset', String(secondsRemaining));

    if (entry.count > limit) {
      response.setHeader('Retry-After', String(secondsRemaining));
      throw new HttpException(
        'Too many requests. Please wait a moment and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private clientKey(request: Request): string {
    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const participantSession = firstHeader(
      request.headers['x-participant-session'],
    );
    if (participantSession) {
      return `participant:${ip}:${tokenFingerprint(participantSession)}`;
    }

    const accessToken =
      readCookie(request.headers.cookie, ACCESS_TOKEN_COOKIE) ??
      readCookie(request.headers.cookie, LEGACY_ACCESS_TOKEN_COOKIE);
    if (accessToken) {
      return `organizer:${ip}:${tokenFingerprint(accessToken)}`;
    }

    const browserToken = readCookie(request.headers.cookie, CSRF_COOKIE);
    if (browserToken) {
      return `browser:${ip}:${tokenFingerprint(browserToken)}`;
    }

    return `anonymous:${ip}`;
  }

  private removeExpired(now: number): void {
    for (const [key, entry] of this.requests) {
      if (entry.resetsAt <= now) this.requests.delete(key);
    }
  }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 24);
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
