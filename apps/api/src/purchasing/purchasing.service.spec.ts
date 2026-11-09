import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PurchasingService } from './purchasing.service.js';

describe('PurchasingService', () => {
  const requester = {
    id: 'requester-a',
    tenantId: 'tenant-a',
    branchIds: ['branch-a'],
    permissions: ['purchasing.create', 'purchasing.receive'],
  };

  it('rejects purchase orders for an unassigned branch', async () => {
    const service = new PurchasingService({} as never, {} as never);

    await expect(
      service.createOrder(requester, {
        branchId: 'branch-b',
        supplierId: 'supplier-a',
        orderNumber: 'PO-1',
        lines: [{ productId: 'product-a', quantity: 1, unitCost: 2, taxRate: 0 }],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('prevents the requester from approving their own order', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'order-a',
      requestedById: requester.id,
      status: 'PENDING_APPROVAL',
      branchId: 'branch-a',
    });
    const service = new PurchasingService({ purchaseOrder: { findFirst } } as never, {} as never);

    await expect(
      service.reviewOrder(requester, 'order-a', { approved: true }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects receipt lines with expired batches before writing', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'order-a',
      status: 'APPROVED',
      branchId: 'branch-a',
      supplierId: 'supplier-a',
      supplier: { paymentTermsDays: 30 },
      lines: [
        {
          id: 'line-a',
          productId: 'product-a',
          orderedQuantity: 10,
          receivedQuantity: 0,
          unitCost: { toNumber: () => 2 },
          taxRate: { toNumber: () => 0 },
        },
      ],
    });
    const transaction = jest.fn();
    const service = new PurchasingService({ purchaseOrder: { findFirst }, $transaction: transaction } as never, {} as never);

    await expect(
      service.receiveOrder(requester, 'order-a', {
        receiptNumber: 'GRN-1',
        idempotencyKey: 'receive-1',
        lines: [
          {
            purchaseOrderLineId: 'line-a',
            batchNumber: 'BATCH-1',
            expiryDate: '2020-01-01',
            quantity: 1,
            unitCost: 2,
            sellingPrice: 3,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
