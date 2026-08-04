import { Module } from '@nestjs/common';
import { ParticipantsModule } from '../participants/participants.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

@Module({
  imports: [ParticipantsModule, RealtimeModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
})
export class AvailabilityModule {}
