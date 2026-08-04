import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import {
  MeetingsController,
  PublicMeetingsController,
} from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [MeetingsController, PublicMeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
