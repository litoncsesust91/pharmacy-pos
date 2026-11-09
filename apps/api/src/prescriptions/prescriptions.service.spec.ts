import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service.js';

describe('PrescriptionsService', () => {
  const user = {
    id: 'pharmacist-a',
    tenantId: 'tenant-a',
    branchIds: ['branch-a'],
    permissions: ['prescription.read', 'prescription.approve', 'prescription.document'],
  };

  it('rejects prescription creation for another tenant customer', async () => {
    const service = new PrescriptionsService(
      { customer: { findFirst: jest.fn().mockResolvedValue(null) } } as never,
      {} as never,
    );

    await expect(
      service.create(user, {
        customerId: 'customer-other-tenant',
        referenceNumber: 'RX-1',
        prescriberName: 'Dr. Test',
        issuedAt: '2026-01-01T00:00:00.000Z',
        lines: [{ productId: 'product-a' }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('prevents the creator from approving a prescription', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'prescription-a',
      createdById: user.id,
      status: 'PENDING_APPROVAL',
    });
    const service = new PrescriptionsService({ prescription: { findFirst } } as never, {} as never);

    await expect(
      service.review(user, 'prescription-a', { approved: true }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not expose a document from another tenant', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new PrescriptionsService({ prescription: { findFirst } } as never, {} as never);

    await expect(service.listDocuments(user, 'prescription-other-tenant')).rejects.toThrow(NotFoundException);
  });
});
