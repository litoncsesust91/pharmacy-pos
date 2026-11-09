import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('system')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check whether the API process is running' })
  getHealth(): { status: 'ok'; service: string } {
    return { status: 'ok', service: 'pharmacy-pos-api' };
  }
}
