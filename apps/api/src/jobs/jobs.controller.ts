import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import {
  CreateReportScheduleDto,
  EnqueueJobDto,
  NotificationQueryDto,
  UpdateNotificationPreferenceDto,
} from './dto/jobs.dto.js';
import { JobsService } from './jobs.service.js';

@ApiTags('jobs')
@Controller()
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get('notifications')
  @RequirePermissions('notifications.read')
  notifications(@CurrentUser() user: AuthenticatedUser, @Query() query: NotificationQueryDto) {
    return this.jobs.listNotifications(user, query);
  }

  @Patch('notifications/:notificationId/read')
  @RequirePermissions('notifications.read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('notificationId') notificationId: string) {
    return this.jobs.markRead(user, notificationId);
  }

  @Get('notification-preferences')
  @RequirePermissions('notifications.read')
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.jobs.getPreferences(user);
  }

  @Patch('notification-preferences')
  @RequirePermissions('notifications.manage')
  updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() input: UpdateNotificationPreferenceDto) {
    return this.jobs.updatePreferences(user, input);
  }

  @Post('jobs')
  @RequirePermissions('jobs.manage')
  enqueue(@CurrentUser() user: AuthenticatedUser, @Body() input: EnqueueJobDto) {
    return this.jobs.enqueue(user, input);
  }

  @Get('jobs/failed')
  @RequirePermissions('jobs.read')
  failedJobs(@CurrentUser() user: AuthenticatedUser) {
    return this.jobs.failedJobs(user);
  }

  @Post('jobs/:jobId/retry')
  @RequirePermissions('jobs.manage')
  retry(@CurrentUser() user: AuthenticatedUser, @Param('jobId') jobId: string) {
    return this.jobs.retry(user, jobId);
  }

  @Get('report-schedules')
  @RequirePermissions('jobs.read')
  schedules(@CurrentUser() user: AuthenticatedUser) {
    return this.jobs.listSchedules(user);
  }

  @Post('report-schedules')
  @RequirePermissions('jobs.manage')
  createSchedule(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateReportScheduleDto) {
    return this.jobs.createSchedule(user, input);
  }
}
