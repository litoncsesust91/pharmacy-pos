import { ConflictException, ForbiddenException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service.js';

describe('SubscriptionsService', () => {
  const user = { id: 'owner-a', tenantId: 'tenant-a', branchIds: ['branch-a'], permissions: ['subscription.manage'] };

  it('rejects suspended tenants before a write', async () => {
    const service = new SubscriptionsService({ tenantSubscription: { findUnique: jest.fn().mockResolvedValue({ status: 'SUSPENDED' }) } } as never, {} as never);
    await expect(service.assertWithinLimit(user, 'products')).rejects.toThrow(ForbiddenException);
  });

  it('enforces plan limits server-side', async () => {
    const service = new SubscriptionsService({
      tenantSubscription: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 86_400_000) })
          .mockResolvedValueOnce({ plan: { limits: { products: 1 } } }),
      },
      product: { count: jest.fn().mockResolvedValue(1) },
    } as never, {} as never);
    await expect(service.assertWithinLimit(user, 'products')).rejects.toThrow(ConflictException);
  });
});
