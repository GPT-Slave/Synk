import { validate } from 'class-validator';
import { SignupDto } from './signup.dto';

describe('SignupDto', () => {
  it('accepts a valid email and strong password', async () => {
    const dto = Object.assign(new SignupDto(), {
      email: 'organizer@example.com',
      password: 'Strong!Pass1',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects malformed email and weak passwords', async () => {
    const dto = Object.assign(new SignupDto(), {
      email: 'not-an-email',
      password: 'password',
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });
});
