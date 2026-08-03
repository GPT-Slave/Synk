import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(72, { message: 'Password must be at most 72 characters.' })
  @Matches(/[a-z]/, { message: 'Password must include a lowercase letter.' })
  @Matches(/[A-Z]/, { message: 'Password must include an uppercase letter.' })
  @Matches(/[0-9]/, { message: 'Password must include a number.' })
  @Matches(/[^A-Za-z0-9]/, {
    message: 'Password must include a special character.',
  })
  password!: string;
}
