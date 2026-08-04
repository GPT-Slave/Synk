import { Module } from '@nestjs/common';
import { MeetingsModule } from '../meetings/meetings.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ParticipantsController } from './participants.controller';
import { ParticipantsService } from './participants.service';

@Module({
  imports: [MeetingsModule, RealtimeModule],
  controllers: [ParticipantsController],
  providers: [ParticipantsService],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
