import { IsISO8601 } from 'class-validator';

export class FinalizeMeetingDto {
  @IsISO8601({ strict: true })
  datetimeStart!: string;

  @IsISO8601({ strict: true })
  datetimeEnd!: string;
}
