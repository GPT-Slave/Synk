import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { readCookie } from '../auth/cookies';
import { CSRF_COOKIE } from './csrf.constants';
import { CsrfService } from './csrf.service';

@Controller('auth')
export class CsrfController {
  constructor(private readonly csrf: CsrfService) {}

  @Get('csrf')
  token(@Res({ passthrough: true }) response: Response) {
    const existing = readCookie(response.req.headers.cookie, CSRF_COOKIE);
    const token = this.csrf.isValid(existing)
      ? existing
      : this.csrf.issueToken();
    response.cookie(CSRF_COOKIE, token, this.csrf.cookieOptions());
    return { token };
  }
}
