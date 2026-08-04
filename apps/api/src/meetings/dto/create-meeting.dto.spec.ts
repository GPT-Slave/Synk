import 'reflect-metadata';
import { validate } from 'class-validator';
import { CreateMeetingDto } from './create-meeting.dto';

function dto(duration: number, slotIntervalMinutes = 15) {
  return Object.assign(new CreateMeetingDto(), {
    title: 'Project sync',
    startDate: '2026-08-12',
    endDate: '2026-08-12',
    workdayStart: '08:00',
    workdayEnd: '20:00',
    slotIntervalMinutes,
    meetingDurationMinutes: duration,
    timezone: 'Africa/Tunis',
  });
}

describe('CreateMeetingDto duration', () => {
  it.each([15, 60, 75, 360])(
    'accepts %i minutes from the slider',
    async (duration) => {
      expect(await validate(dto(duration))).toHaveLength(0);
    },
  );

  it.each([0, 14, 16, 361, 375])(
    'rejects %i minutes outside the slider contract',
    async (duration) => {
      const errors = await validate(dto(duration));
      expect(
        errors.some((error) => error.property === 'meetingDurationMinutes'),
      ).toBe(true);
    },
  );

  it.each([15, 30, 60])(
    'accepts %i-minute timetable slots',
    async (interval) => {
      expect(await validate(dto(60, interval))).toHaveLength(0);
    },
  );
});
