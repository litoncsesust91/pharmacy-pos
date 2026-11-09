import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';

describe('PaymentsService', () => {
  const user = {
    id: 'cashier-a',
    tenantId: 'tenant-a',
    branchIds: ['branch-a'],
    permissions: ['payments.create', 'cash.close', 'cash.approve'],
  };

  it('rejects payment creation for an already-paid sale', async () => {
    const service = new PaymentsService(
      { sale: { findFirst: jest.fn().mockResolvedValue({ paymentStatus: 'PAID' }) } } as never,
      {} as never,
    );

    await expect(
      service.createPayment(user, {
        saleId: 'sale-a',
        method: 'cash',
        amount: 10,
        idempotencyKey: 'payment-a',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects forged payment webhooks before database writes', async () => {
    const create = jest.fn();
    const service = new PaymentsService({ paymentWebhookEvent: { create } } as never, {} as never);

    await expect(
      service.handleWebhook('forged', {
        provider: 'local-card',
        eventId: 'event-a',
        paymentId: 'payment-a',
        status: 'CONFIRMED',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(create).not.toHaveBeenCalled();
  });

  it('prevents a cashier from approving their own cash discrepancy', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'session-a',
      closedById: user.id,
      status: 'PENDING_APPROVAL',
    });
    const service = new PaymentsService({ cashSession: { findFirst } } as never, {} as never);

    await expect(
      service.approveClose(user, 'session-a', { approved: true }),
    ).rejects.toThrow(ForbiddenException);
  });
});
