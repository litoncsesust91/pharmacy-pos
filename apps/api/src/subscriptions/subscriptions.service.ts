import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { BillingWebhookDto, CancelSubscriptionDto, ChangeSubscriptionDto } from './dto/subscriptions.dto.js';
import { LocalBillingProvider } from './billing-provider.js';

type Limits = { branches?: number; users?: number; products?: number; monthlySales?: number };

@Injectable()
export class SubscriptionsService {
  private readonly provider = new LocalBillingProvider();

  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async getPlans() { return this.prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { monthlyPrice: 'asc' } }); }

  async getCurrent(user: AuthenticatedUser) {
    const subscription = await this.prisma.tenantSubscription.findUnique({ where: { tenantId: user.tenantId }, include: { plan: true } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    return { ...subscription, usage: await this.usage(user.tenantId, subscription.plan.limits as Limits) };
  }

  async changePlan(user: AuthenticatedUser, input: ChangeSubscriptionDto) {
    const plan = await this.prisma.subscriptionPlan.findFirst({ where: { key: input.planKey.trim(), isActive: true } });
    if (!plan) throw new NotFoundException('Subscription plan not found');
    const current = await this.prisma.tenantSubscription.findUnique({ where: { tenantId: user.tenantId } });
    if (!current) throw new NotFoundException('Subscription not found');
    const providerSubscription = await this.provider.createSubscription({ tenantId: user.tenantId, planKey: plan.key });
    const updated = await this.prisma.tenantSubscription.update({ where: { tenantId: user.tenantId }, data: { planId: plan.id, status: 'ACTIVE', provider: this.provider.name, providerCustomerId: providerSubscription.customerId, providerSubscriptionId: providerSubscription.subscriptionId, canceledAt: null, suspendedAt: null } });
    await this.auditChange(user, 'subscription.plan.changed', updated.id, { planKey: plan.key });
    await this.notifyOwners(user.tenantId, 'Subscription plan changed', `Your tenant is now on the ${plan.name} plan.`);
    return this.getCurrent(user);
  }

  async cancel(user: AuthenticatedUser, input: CancelSubscriptionDto) {
    const current = await this.prisma.tenantSubscription.findUnique({ where: { tenantId: user.tenantId } });
    if (!current) throw new NotFoundException('Subscription not found');
    if (current.status === 'CANCELED') return current;
    if (current.providerSubscriptionId) await this.provider.cancelSubscription(current.providerSubscriptionId);
    const updated = await this.prisma.tenantSubscription.update({ where: { tenantId: user.tenantId }, data: { status: 'CANCELED', canceledAt: new Date() } });
    await this.auditChange(user, 'subscription.canceled', updated.id, { reason: input.reason?.trim() });
    await this.notifyOwners(user.tenantId, 'Subscription canceled', 'Your subscription has been canceled.');
    return updated;
  }

  async handleWebhook(input: BillingWebhookDto, signature: string | undefined) {
    const payload = JSON.stringify(input);
    if (!this.provider.verifyWebhook(payload, signature)) throw new ForbiddenException('Invalid billing webhook signature');
    const existing = await this.prisma.billingEvent.findUnique({ where: { provider_eventId: { provider: this.provider.name, eventId: input.eventId } } });
    if (existing) return { processed: true, replay: true };
    const subscription = await this.prisma.tenantSubscription.findUnique({ where: { tenantId: input.tenantId } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    await this.prisma.billingEvent.create({ data: { tenantId: input.tenantId, provider: this.provider.name, eventId: input.eventId, eventType: input.eventType, payload: input as unknown as Prisma.InputJsonValue, processedAt: new Date() } });
    await this.prisma.tenantSubscription.update({ where: { tenantId: input.tenantId }, data: { status: input.status?.toUpperCase() ?? subscription.status, suspendedAt: input.status === 'suspended' ? new Date() : null } });
    return { processed: true, replay: false };
  }

  async assertEntitled(tenantId: string) {
    const subscription = await this.prisma.tenantSubscription.findUnique({ where: { tenantId }, select: { status: true, trialEndsAt: true, currentPeriodEnd: true } });
    if (!subscription) throw new ForbiddenException('Active subscription required');
    const trialExpired = subscription.status === 'TRIALING' && !!subscription.trialEndsAt && subscription.trialEndsAt <= new Date();
    const periodExpired = subscription.status === 'ACTIVE' && subscription.currentPeriodEnd <= new Date();
    if (trialExpired || periodExpired || ['SUSPENDED', 'CANCELED'].includes(subscription.status)) throw new ForbiddenException('Subscription is not active');
  }

  async assertWithinLimit(user: AuthenticatedUser, metric: keyof Limits, requested = 1) {
    await this.assertEntitled(user.tenantId);
    const subscription = await this.prisma.tenantSubscription.findUnique({ where: { tenantId: user.tenantId }, include: { plan: true } });
    const limit = (subscription?.plan.limits as Limits | undefined)?.[metric];
    if (limit === undefined) return;
    const counts: Record<string, () => Promise<number>> = {
      branches: () => this.prisma.branch.count({ where: { tenantId: user.tenantId, isActive: true } }),
      users: () => this.prisma.user.count({ where: { tenantId: user.tenantId, isActive: true } }),
      products: () => this.prisma.product.count({ where: { tenantId: user.tenantId, isActive: true } }),
      monthlySales: () => this.prisma.sale.count({ where: { tenantId: user.tenantId, status: 'COMPLETED', createdAt: { gte: this.monthStart() } } }),
    };
    const count = await counts[metric]!();
    if (count + requested > limit) throw new ConflictException(`Subscription limit reached for ${metric}`);
  }

  private async usage(tenantId: string, limits: Limits) {
    const [branches, users, products, monthlySales] = await Promise.all([
      this.prisma.branch.count({ where: { tenantId, isActive: true } }),
      this.prisma.user.count({ where: { tenantId, isActive: true } }),
      this.prisma.product.count({ where: { tenantId, isActive: true } }),
      this.prisma.sale.count({ where: { tenantId, status: 'COMPLETED', createdAt: { gte: this.monthStart() } } }),
    ]);
    const periodStart = this.monthStart();
    await Promise.all([
      ['branches', branches],
      ['users', users],
      ['products', products],
      ['monthlySales', monthlySales],
    ].map(([metric, quantity]) => this.prisma.subscriptionUsage.upsert({ where: { tenantId_metric_periodStart: { tenantId, metric: metric as string, periodStart } }, update: { quantity: quantity as number }, create: { tenantId, metric: metric as string, periodStart, quantity: quantity as number } })));
    return { branches: { used: branches, limit: limits.branches ?? null }, users: { used: users, limit: limits.users ?? null }, products: { used: products, limit: limits.products ?? null }, monthlySales: { used: monthlySales, limit: limits.monthlySales ?? null } };
  }

  private monthStart() { const date = new Date(); date.setUTCDate(1); date.setUTCHours(0, 0, 0, 0); return date; }
  private async auditChange(user: AuthenticatedUser, action: string, entityId: string, metadata: Record<string, unknown>) { await this.audit.record({ tenantId: user.tenantId, actorId: user.id, action, entityType: 'TenantSubscription', entityId, metadata: metadata as Prisma.InputJsonObject }); }
  private async notifyOwners(tenantId: string, title: string, body: string) {
    const owners = await this.prisma.user.findMany({ where: { tenantId, isActive: true, userRoles: { some: { role: { key: 'owner' } } } }, select: { id: true } });
    await this.prisma.notification.createMany({ data: owners.map(({ id }) => ({ tenantId, userId: id, type: 'SUBSCRIPTION', title, body, dedupeKey: `subscription:${title}:${Date.now()}` })), skipDuplicates: true });
  }
}
