import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  MeetingsController,
  PublicMeetingsController,
} from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  imports: [AuthModule],
  controllers: [MeetingsController, PublicMeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
