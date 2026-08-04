import { IsBoolean } from 'class-validator';

export class LockMeetingDto {
  @IsBoolean()
  locked!: boolean;
}
