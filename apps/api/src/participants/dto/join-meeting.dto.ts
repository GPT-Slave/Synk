import { IsString, Length } from 'class-validator';

export class JoinMeetingDto {
  @IsString()
  @Length(2, 30)
  displayName!: string;
}
