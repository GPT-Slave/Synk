import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { FinalizeMeetingDto } from './dto/finalize-meeting.dto';
import { ListMeetingsQueryDto } from './dto/list-meetings-query.dto';
import { LockMeetingDto } from './dto/lock-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { UpdateAvailabilityDto } from '../availability/dto/update-availability.dto';
import { MeetingsService } from './meetings.service';

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMeetingDto) {
    return this.meetings.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListMeetingsQueryDto) {
    return this.meetings.list(user.id, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.meetings.detail(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMeetingDto,
  ) {
    return this.meetings.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.meetings.remove(user.id, id);
  }

  @Delete(':id/participants/:participantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeParticipant(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('participantId') participantId: string,
  ) {
    return this.meetings.removeParticipant(user.id, id, participantId);
  }

  @Put(':id/availability')
  saveOrganizerAvailability(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.meetings.saveOrganizerAvailability(user, id, dto);
  }

  @Post(':id/finalize')
  finalize(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: FinalizeMeetingDto,
  ) {
    return this.meetings.finalize(user.id, id, dto);
  }

  @Patch(':id/lock')
  setLocked(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: LockMeetingDto,
  ) {
    return this.meetings.setLocked(user.id, id, dto.locked);
  }

  @Post(':id/reopen')
  reopen(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.meetings.reopen(user.id, id);
  }
}

@Controller('public/meetings')
export class PublicMeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get(':token')
  detail(@Param('token') token: string) {
    return this.meetings.publicMeeting(token);
  }
}
