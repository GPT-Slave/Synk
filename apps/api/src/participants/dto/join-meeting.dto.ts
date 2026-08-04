import { IsString, Length } from 'class-validator';
import { PlainText } from '../../security/plain-text';

export class JoinMeetingDto {
  @IsString()
  @Length(2, 30)
  @PlainText()
  displayName!: string;
}
