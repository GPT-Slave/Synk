import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CsrfController } from './csrf.controller';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from './csrf.service';
import { GlobalRateLimitGuard } from './global-rate-limit.guard';

@Global()
@Module({
  controllers: [CsrfController],
  providers: [
    CsrfService,
    { provide: APP_GUARD, useClass: GlobalRateLimitGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
  exports: [CsrfService],
})
export class SecurityModule {}
