import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListMeetingsQueryDto } from './list-meetings-query.dto';

describe('ListMeetingsQueryDto', () => {
  it('accepts bounded cursor pagination parameters', async () => {
    const dto = plainToInstance(ListMeetingsQueryDto, {
      cursor: 'meeting-cursor',
      limit: '50',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.limit).toBe(50);
  });

  it.each([
    { limit: '0' },
    { limit: '51' },
    { limit: 'not-a-number' },
    { cursor: 'x'.repeat(65) },
  ])('rejects invalid pagination input %#', async (input) => {
    const dto = plainToInstance(ListMeetingsQueryDto, input);
    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
