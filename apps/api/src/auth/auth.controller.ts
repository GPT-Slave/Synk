import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthRateLimit } from './auth-rate-limit.decorator';
import { CurrentUser } from './current-user.decorator';
import { readCookie } from './cookies';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  type AuthUser,
  type SessionTokens,
} from './auth.types';

@Controller('auth')
@UseGuards(AuthRateLimitGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('signup')
  @AuthRateLimit({ limit: 5, windowMs: 60_000 })
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.signup(dto);
    this.setSessionCookies(response, session);
    return { user: session.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @AuthRateLimit({ limit: 5, windowMs: 60_000 })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.login(dto);
    this.setSessionCookies(response, session);
    return { user: session.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @AuthRateLimit({ limit: 30, windowMs: 60_000 })
  async refresh(@Res({ passthrough: true }) response: Response) {
    const session = await this.auth.refresh(
      readCookie(response.req.headers.cookie, REFRESH_TOKEN_COOKIE),
    );
    this.setSessionCookies(response, session);
    return { user: session.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthRateLimit({ limit: 30, windowMs: 60_000 })
  async logout(@Res({ passthrough: true }) response: Response) {
    await this.auth.logout(
      readCookie(response.req.headers.cookie, REFRESH_TOKEN_COOKIE),
    );
    response.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions('/'));
    response.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions('/auth'));
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @AuthRateLimit({ limit: 60, windowMs: 60_000 })
  session(@CurrentUser() user: AuthUser) {
    return { user };
  }

  private setSessionCookies(response: Response, session: SessionTokens) {
    response.cookie(ACCESS_TOKEN_COOKIE, session.accessToken, {
      ...this.cookieOptions('/'),
      maxAge: session.accessTokenMaxAgeMs,
    });
    response.cookie(REFRESH_TOKEN_COOKIE, session.refreshToken, {
      ...this.cookieOptions('/auth'),
      maxAge: session.refreshTokenMaxAgeMs,
    });
  }

  private cookieOptions(path: string): CookieOptions {
    const secure =
      this.config.get<string>('COOKIE_SECURE') === 'true' ||
      this.config.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path,
    };
  }
}
