import { Injectable, OnModuleDestroy, OnModuleInit, NotFoundException, ConflictException } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateReportScheduleDto,
  EnqueueJobDto,
  NotificationQueryDto,
  UpdateNotificationPreferenceDto,
} from './dto/jobs.dto.js';

const allowedJobTypes = new Set(['LOW_STOCK', 'NEAR_EXPIRY', 'EXPIRED_STOCK', 'DAILY_SALES_SUMMARY', 'SCHEDULED_REPORT', 'REPORT_EXPORT']);

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly queue?: Queue;
  private worker?: Worker;
  private scheduleTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    if (process.env.NODE_ENV !== 'test') {
      this.queue = new Queue('pharmacy-pos-background', { connection: this.redisConnection() });
    }
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.worker = new Worker<{ jobRecordId: string }>(
      'pharmacy-pos-background',
      async (job) => this.processJob(job),
      { connection: this.redisConnection(), concurrency: 2 },
    );
    this.scheduleTimer = setInterval(() => void this.enqueueDueSchedules(), 60_000);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.scheduleTimer) clearInterval(this.scheduleTimer);
    await this.worker?.close();
    await this.queue?.close();
  }

  listNotifications(user: AuthenticatedUser, query: NotificationQueryDto) {
    return this.prisma.notification.findMany({
      where: { tenantId: user.tenantId, userId: user.id, ...(query.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(user: AuthenticatedUser, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id: notificationId, tenantId: user.tenantId, userId: user.id } });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id: notification.id }, data: { readAt: new Date() } });
  }

  getPreferences(user: AuthenticatedUser) {
    return this.prisma.notificationPreference.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
  }

  async updatePreferences(user: AuthenticatedUser, input: UpdateNotificationPreferenceDto) {
    const preferences = await this.prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: input,
      create: { userId: user.id, ...input },
    });
    await this.audit.record({ tenantId: user.tenantId, actorId: user.id, action: 'notification.preferences.updated', entityType: 'NotificationPreference', entityId: preferences.id, metadata: input as unknown as Prisma.InputJsonObject });
    return preferences;
  }

  async enqueue(user: AuthenticatedUser, input: EnqueueJobDto) {
    if (!allowedJobTypes.has(input.jobType)) throw new ConflictException('Unsupported background job type');
    const existing = await this.prisma.backgroundJob.findUnique({ where: { tenantId_dedupeKey: { tenantId: user.tenantId, dedupeKey: input.dedupeKey } } });
    if (existing && !['FAILED', 'COMPLETED'].includes(existing.status)) return existing;
    const job = existing
      ? await this.prisma.backgroundJob.update({ where: { id: existing.id }, data: { status: 'QUEUED', attempts: 0, lastError: null, completedAt: null, payload: (input.payload ?? {}) as Prisma.InputJsonValue } })
      : await this.prisma.backgroundJob.create({ data: { tenantId: user.tenantId, requestedById: user.id, queueName: 'pharmacy-pos-background', jobType: input.jobType, payload: (input.payload ?? {}) as Prisma.InputJsonValue, dedupeKey: input.dedupeKey } });
    if (!this.queue) throw new ConflictException('Background queue is unavailable');
    await this.queue.add(input.jobType, { jobRecordId: job.id }, { jobId: job.id, attempts: job.maxAttempts, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: false, removeOnFail: false });
    await this.audit.record({ tenantId: user.tenantId, actorId: user.id, action: 'background-job.queued', entityType: 'BackgroundJob', entityId: job.id, metadata: { jobType: input.jobType } });
    return job;
  }

  failedJobs(user: AuthenticatedUser) {
    return this.prisma.backgroundJob.findMany({ where: { tenantId: user.tenantId, status: 'FAILED' }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async retry(user: AuthenticatedUser, jobId: string) {
    const job = await this.prisma.backgroundJob.findFirst({ where: { id: jobId, tenantId: user.tenantId, status: 'FAILED' } });
    if (!job) throw new NotFoundException('Failed job not found');
    return this.enqueue(user, { jobType: job.jobType, dedupeKey: `${job.dedupeKey}:retry:${Date.now()}`, payload: job.payload as Record<string, unknown> });
  }

  listSchedules(user: AuthenticatedUser) {
    return this.prisma.reportSchedule.findMany({ where: { tenantId: user.tenantId }, orderBy: { createdAt: 'desc' } });
  }

  async createSchedule(user: AuthenticatedUser, input: CreateReportScheduleDto) {
    const schedule = await this.prisma.reportSchedule.create({
      data: { tenantId: user.tenantId, createdById: user.id, name: input.name.trim(), reportType: input.reportType, cron: input.cron.trim(), filters: input.filters as Prisma.InputJsonValue, nextRunAt: input.nextRunAt ? new Date(input.nextRunAt) : new Date() },
    });
    await this.audit.record({ tenantId: user.tenantId, actorId: user.id, action: 'report-schedule.created', entityType: 'ReportSchedule', entityId: schedule.id, metadata: { reportType: input.reportType } });
    return schedule;
  }

  private async processJob(job: Job<{ jobRecordId: string }>) {
    const record = await this.prisma.backgroundJob.findUnique({ where: { id: job.data.jobRecordId } });
    if (!record) return;
    await this.prisma.backgroundJob.update({ where: { id: record.id }, data: { status: 'RUNNING', attempts: { increment: 1 } } });
    try {
      if (record.jobType === 'LOW_STOCK') await this.lowStock(record.tenantId);
      else if (record.jobType === 'NEAR_EXPIRY') await this.expiry(record.tenantId, false);
      else if (record.jobType === 'EXPIRED_STOCK') await this.expiry(record.tenantId, true);
      else if (record.jobType === 'DAILY_SALES_SUMMARY') await this.dailySummary(record.tenantId);
       else if (record.jobType === 'SCHEDULED_REPORT' || record.jobType === 'REPORT_EXPORT') await this.scheduledReport(record.tenantId, record.payload);
      await this.prisma.backgroundJob.update({ where: { id: record.id }, data: { status: 'COMPLETED', completedAt: new Date(), lastError: null } });
    } catch (error) {
      await this.prisma.backgroundJob.update({ where: { id: record.id }, data: { status: 'FAILED', lastError: String(error).slice(0, 1000) } });
      throw error;
    }
  }

  private async lowStock(tenantId: string) {
    const products = await this.prisma.product.findMany({ where: { tenantId, isActive: true, minimumStock: { gt: 0 } }, include: { inventoryBatches: { select: { quantity: true } } } });
    const low = products.filter((product) => product.inventoryBatches.reduce((sum, batch) => sum + batch.quantity, 0) <= product.minimumStock);
    for (const product of low) await this.notify(tenantId, 'LOW_STOCK', `Low stock: ${product.name}`, `${product.name} is at or below its minimum stock level.`, `low-stock:${product.id}`);
  }

  private async expiry(tenantId: string, expired: boolean) {
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    const end = new Date(Date.now() + (settings?.expiryWarningDays ?? 90) * 86400000);
    const batches = await this.prisma.inventoryBatch.findMany({ where: { tenantId, quantity: { gt: 0 }, expiryDate: expired ? { lt: new Date() } : { gte: new Date(), lte: end }, recalled: false, quarantined: false }, include: { product: true } });
    for (const batch of batches) await this.notify(tenantId, expired ? 'EXPIRED_STOCK' : 'NEAR_EXPIRY', `${expired ? 'Expired' : 'Near expiry'} stock`, `${batch.product.name} batch ${batch.batchNumber} requires attention.`, `${expired ? 'expired' : 'near-expiry'}:${batch.id}:${batch.expiryDate.toISOString().slice(0, 10)}`);
  }

  private async dailySummary(tenantId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const sales = await this.prisma.sale.aggregate({ where: { tenantId, status: 'COMPLETED', createdAt: { gte: start } }, _count: { id: true }, _sum: { total: true } });
    await this.notify(tenantId, 'DAILY_SALES_SUMMARY', 'Daily sales summary', `${sales._count.id} sales recorded today. Total: ${sales._sum.total?.toString() ?? '0'}.`, `daily-summary:${start.toISOString().slice(0, 10)}`);
  }

  private async scheduledReport(tenantId: string, payload: Prisma.JsonValue) {
    await this.notify(tenantId, 'SCHEDULED_REPORT', 'Scheduled report ready', `The ${JSON.stringify(payload).slice(0, 200)} report job completed.`, `scheduled-report:${Date.now()}`);
  }

  private async notify(tenantId: string, type: string, title: string, body: string, dedupeBase: string) {
    const users = await this.prisma.user.findMany({ where: { tenantId, isActive: true }, include: { notificationPreference: true } });
    for (const user of users) {
      const preference = user.notificationPreference;
      if (preference && (!preference.inApp || (type === 'LOW_STOCK' && !preference.lowStock) || ((type === 'NEAR_EXPIRY' || type === 'EXPIRED_STOCK') && !preference.expiry) || (type === 'DAILY_SALES_SUMMARY' && !preference.summaries))) continue;
      await this.prisma.notification.createMany({ data: [{ tenantId, userId: user.id, type, title, body, dedupeKey: dedupeBase }], skipDuplicates: true });
    }
  }

  private async enqueueDueSchedules() {
    const schedules = await this.prisma.reportSchedule.findMany({ where: { enabled: true, nextRunAt: { lte: new Date() } } });
    for (const schedule of schedules) {
      await this.prisma.backgroundJob.create({ data: { tenantId: schedule.tenantId, requestedById: schedule.createdById, queueName: 'pharmacy-pos-background', jobType: 'SCHEDULED_REPORT', payload: { reportType: schedule.reportType, filters: schedule.filters }, dedupeKey: `schedule:${schedule.id}:${schedule.nextRunAt?.toISOString()}` } }).then(async (job) => {
        if (this.queue) await this.queue.add('SCHEDULED_REPORT', { jobRecordId: job.id }, { jobId: job.id, attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
      }).catch(() => undefined);
      await this.prisma.reportSchedule.update({ where: { id: schedule.id }, data: { lastRunAt: new Date(), nextRunAt: new Date(Date.now() + 86400000) } });
    }
  }

  private redisConnection() {
    const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
    return { host: url.hostname, port: Number(url.port || 6379), password: url.password || undefined };
  }
}
