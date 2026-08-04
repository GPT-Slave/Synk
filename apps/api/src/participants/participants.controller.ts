import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { JoinMeetingDto } from './dto/join-meeting.dto';
import { ParticipantsService } from './participants.service';

@Controller('public/meetings/:token')
export class ParticipantsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Post('participants')
  join(@Param('token') token: string, @Body() dto: JoinMeetingDto) {
    return this.participants.join(token, dto.displayName);
  }

  @Get('session')
  session(
    @Param('token') token: string,
    @Headers('x-participant-session') sessionToken: string | undefined,
  ) {
    return this.participants.session(token, sessionToken);
  }
}
