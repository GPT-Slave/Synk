import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { PlainText } from '../../security/plain-text';

export class LoginDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  @PlainText()
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Password is required.' })
  @MaxLength(72)
  password!: string;
}
