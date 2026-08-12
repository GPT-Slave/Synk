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
      date: new Date().toISOString().slice(0, 10),
      timeLabel: '08:00',
      availableCount: 1,
      totalParticipants: 1,
      percentage: 100,
      participantIds: ['example-participant'],
      participantNames: ['Example'],
    };
  }
}
