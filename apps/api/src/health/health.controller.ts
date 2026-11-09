import { Controller, Get, Optional } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('system')
@Controller('health')
export class HealthController {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Check whether the API process is running' })
  getHealth(): { status: 'ok'; service: string } {
    return { status: 'ok', service: 'pharmacy-pos-api' };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Check database readiness' })
  async getReadiness(): Promise<{ status: 'ok' | 'degraded'; service: string; database: 'ok' | 'unavailable' }> {
    if (!this.prisma) return { status: 'degraded', service: 'pharmacy-pos-api', database: 'unavailable' };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', service: 'pharmacy-pos-api', database: 'ok' };
    } catch {
      return { status: 'degraded', service: 'pharmacy-pos-api', database: 'unavailable' };
    }
  }
}
