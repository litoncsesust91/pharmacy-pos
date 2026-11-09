import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ExportReportDto, ReportQueryDto } from './dto/reports.dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @RequirePermissions('reports.read')
  run(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportQueryDto) { return this.reports.run(user, query); }

  @Get('export')
  @RequirePermissions('reports.export')
  export(@CurrentUser() user: AuthenticatedUser, @Query() query: ExportReportDto, @Res() response: Response) { return this.reports.export(user, query, response); }

  @Get('exports/:token')
  @RequirePermissions('reports.export')
  download(@CurrentUser() user: AuthenticatedUser, @Param('token') token: string, @Res() response: Response) { return this.reports.download(user, token, response); }
}
