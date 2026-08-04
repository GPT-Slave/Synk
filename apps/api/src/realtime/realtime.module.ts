import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MeetingsRealtimeGateway } from './meetings-realtime.gateway';

@Module({
  imports: [AuthModule],
  providers: [MeetingsRealtimeGateway],
  exports: [MeetingsRealtimeGateway],
})
export class RealtimeModule {}
