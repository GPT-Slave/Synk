import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  ValidateNested,
} from 'class-validator';

export class AvailabilitySlotInput {
  @IsISO8601({ strict: true })
  datetimeStart!: string;

  @IsISO8601({ strict: true })
  datetimeEnd!: string;
}

export class UpdateAvailabilityDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotInput)
  slots!: AvailabilitySlotInput[];
}
