import { BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service.js';

describe('ReportsService', () => {
  const user = { id: 'owner-a', tenantId: 'tenant-a', branchIds: ['branch-a'], permissions: ['reports.read'] };

  it('rejects a report branch outside the assigned scope', async () => {
    const service = new ReportsService({} as never, {} as never, {} as never);
    await expect(service.run(user, { type: 'INVENTORY', branchId: 'branch-b', page: 1, pageSize: 100 })).rejects.toThrow(BadRequestException);
  });

  it('scopes inventory valuation to assigned branches', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ReportsService({ inventoryBatch: { findMany } } as never, {} as never, {} as never);
    const report = await service.run(user, { type: 'INVENTORY', page: 1, pageSize: 100 });
    expect(report.summary.valuation).toBe(0);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
