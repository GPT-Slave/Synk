import { Injectable } from '@nestjs/common';
import type { BestMatchDto } from '@meet-planner/shared-types';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  // Placeholder proving @meet-planner/shared-types wiring (F0.6).
  getExampleBestMatch(): BestMatchDto {
    return {
      datetimeStart: new Date().toISOString(),
      datetimeEnd: new Date().toISOString(),
      percentage: 100,
    };
  }
}
