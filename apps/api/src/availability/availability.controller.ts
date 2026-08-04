import { Body, Controller, Headers, Param, Put } from '@nestjs/common';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { AvailabilityService } from './availability.service';

@Controller('public/meetings/:token/availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Put()
  replace(
    @Param('token') token: string,
    @Headers('x-participant-session') sessionToken: string | undefined,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.availability.replace(token, sessionToken, dto);
  }
}
