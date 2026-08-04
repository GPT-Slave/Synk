import {
  IsDivisibleBy,
  IsIn,
  IsInt,
  Max,
  Min,
  IsOptional,
  IsString,
  IsTimeZone,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { PlainText } from '../../security/plain-text';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

export class CreateMeetingDto {
  @IsString()
  @Length(2, 120)
  @PlainText()
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @PlainText()
  description?: string;

  @Matches(DATE_ONLY, { message: 'startDate must use YYYY-MM-DD.' })
  startDate!: string;

  @Matches(DATE_ONLY, { message: 'endDate must use YYYY-MM-DD.' })
  endDate!: string;

  @Matches(TIME_ONLY, { message: 'workdayStart must use HH:mm.' })
  workdayStart!: string;

  @Matches(TIME_ONLY, { message: 'workdayEnd must use HH:mm.' })
  workdayEnd!: string;

  @IsOptional()
  @IsInt()
  @IsIn([15, 30, 60])
  slotIntervalMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(360)
  @IsDivisibleBy(15)
  meetingDurationMinutes?: number;

  @IsTimeZone()
  timezone!: string;
}
