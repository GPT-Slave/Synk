import type { Request } from 'express';

export const ACCESS_TOKEN_COOKIE = 'synk_access';
export const REFRESH_TOKEN_COOKIE = 'synk_refresh';
export const LEGACY_ACCESS_TOKEN_COOKIE = 'calendra_access';
export const LEGACY_REFRESH_TOKEN_COOKIE = 'calendra_refresh';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenMaxAgeMs: number;
  refreshTokenMaxAgeMs: number;
  user: AuthUser;
}
