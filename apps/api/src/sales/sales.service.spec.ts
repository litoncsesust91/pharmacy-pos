import { ForbiddenException } from '@nestjs/common';
import { SalesService } from './sales.service.js';

describe('SalesService', () => {
  const user = {
    id: 'cashier-a',
    tenantId: 'tenant-a',
    branchIds: ['branch-a'],
    permissions: ['sales.create', 'sales.read'],
  };

  it('rejects sales for an unassigned branch', async () => {
    const service = new SalesService({} as never, {} as never);

    await expect(
      service.createSale(user, {
        branchId: 'branch-b',
        saleNumber: 'POS-1',
        idempotencyKey: 'sale-1',
        channel: 'ONLINE',
        lines: [{ productId: 'product-a', quantity: 1 }],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks controlled products in offline mode by default', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const service = new SalesService(
      {
        sale: { findUnique },
        tenantSettings: {
          findUnique: jest.fn().mockResolvedValue({
            taxEnabled: true,
            taxRate: { toNumber: () => 0 },
            offlineHighRiskSalesAllowed: false,
          }),
        },
        product: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'product-a',
              name: 'Controlled Medicine',
              sku: 'CONTROL-1',
              sellingPrice: { toNumber: () => 10 },
              prescriptionRequired: false,
              controlledDrug: true,
            },
          ]),
        },
      } as never,
      {} as never,
    );

    await expect(
      service.createSale(user, {
        branchId: 'branch-a',
        saleNumber: 'POS-2',
        idempotencyKey: 'sale-2',
        channel: 'OFFLINE',
        lines: [{ productId: 'product-a', quantity: 1 }],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns the original result for a duplicate idempotency key', async () => {
    const existing = { id: 'sale-a', status: 'COMPLETED' };
    const findUnique = jest.fn().mockResolvedValue(existing);
    const service = new SalesService({ sale: { findUnique } } as never, {} as never);

    await expect(
      service.createSale(user, {
        branchId: 'branch-a',
        saleNumber: 'POS-3',
        idempotencyKey: 'sale-3',
        channel: 'OFFLINE',
        lines: [{ productId: 'product-a', quantity: 1 }],
      }),
    ).resolves.toBe(existing);
  });
});
