import { NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';

describe('CatalogService', () => {
  const user = {
    id: 'owner-a',
    tenantId: 'tenant-a',
    branchIds: ['branch-a'],
    permissions: ['catalog.read', 'catalog.manage'],
  };

  it('scopes company reads to the authenticated tenant', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new CatalogService(
      { company: { findMany } } as never,
      {} as never,
    );

    await service.listCompanies(user);

    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', isActive: true },
      orderBy: { name: 'asc' },
    });
  });

  it('rejects a product reference from another tenant', async () => {
    const service = new CatalogService(
      {
        company: { findFirst: jest.fn().mockResolvedValue(null) },
      } as never,
      {} as never,
    );

    await expect(
      service.createProduct(user, {
        name: 'Test Medicine',
        sku: 'TEST-1',
        purchasePrice: 1,
        sellingPrice: 2,
        companyId: 'company-from-other-tenant',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects duplicate barcode values before writing product data', async () => {
    const create = jest.fn();
    const service = new CatalogService(
      {
        $transaction: create,
      } as never,
      {} as never,
    );

    await expect(
      service.createProduct(user, {
        name: 'Test Medicine',
        sku: 'TEST-2',
        purchasePrice: 1,
        sellingPrice: 2,
        barcodes: ['12345', '12345'],
      }),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it('reports duplicate rows during import validation', async () => {
    const transaction = jest.fn().mockResolvedValue([
      [],
      [],
    ]);
    const service = new CatalogService(
      {
        $transaction: transaction,
        product: { findMany: jest.fn().mockResolvedValue([]) },
        productBarcode: { findMany: jest.fn().mockResolvedValue([]) },
      } as never,
      {} as never,
    );

    const result = await service.validateProductImport(user, {
      rows: [
        { name: 'Medicine A', sku: 'DUP-1', purchasePrice: 1, sellingPrice: 2 },
        { name: 'Medicine B', sku: 'DUP-1', purchasePrice: 1, sellingPrice: 2 },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Duplicate SKU in import: DUP-1');
  });
});
