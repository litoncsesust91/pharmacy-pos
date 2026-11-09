import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';

@ApiTags('system')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({ summary: 'Check whether the API process is running' })
  getHealth(): { status: 'ok'; service: string } {
    return { status: 'ok', service: 'pharmacy-pos-api' };
  }
}
