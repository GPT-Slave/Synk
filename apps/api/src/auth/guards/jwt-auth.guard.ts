import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { readCookie } from '../cookies';
import {
  ACCESS_TOKEN_COOKIE,
  type AccessTokenPayload,
  type AuthenticatedRequest,
} from '../auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Authentication required.');

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      if (payload.type !== 'access' || !payload.sub || !payload.email) {
        throw new Error('Invalid access token payload');
      }

      (request as AuthenticatedRequest).user = {
        id: payload.sub,
        email: payload.email,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Your session has expired.');
    }
  }

  private extractToken(request: Request): string | undefined {
    const [scheme, bearerToken] =
      request.headers.authorization?.split(' ') ?? [];
    if (scheme === 'Bearer' && bearerToken) return bearerToken;
    return readCookie(request.headers.cookie, ACCESS_TOKEN_COOKIE);
  }
}
