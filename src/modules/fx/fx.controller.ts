import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FxService } from './fx.service';

@ApiTags('fx')
@Controller('fx')
export class FxController {
  constructor(private readonly fx: FxService) {}

  // Public: exchange rates are not user-specific, so no auth guard. Lets the
  // client refresh the rate even before login.
  @Get('rates')
  @ApiOperation({ summary: 'Current USD→KHR exchange rate (cached)' })
  rates() {
    return this.fx.getRates();
  }
}
