import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { JoinMeetingDto } from '../participants/dto/join-meeting.dto';
import { UpdateAvailabilityDto } from '../availability/dto/update-availability.dto';

describe('plain-text input normalization', () => {
  it('normalizes Unicode and removes control and bidi override characters', async () => {
    const dto = plainToInstance(JoinMeetingDto, {
      displayName: 'Ｄhia\u0000\u202e',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.displayName).toBe('Dhia');
  });

  it('keeps HTML-looking comments as inert plain text for React escaping', async () => {
    const dto = plainToInstance(UpdateAvailabilityDto, {
      slots: [],
      comment: '<img src=x onerror=alert(1)>',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.comment).toBe('<img src=x onerror=alert(1)>');
  });
});
