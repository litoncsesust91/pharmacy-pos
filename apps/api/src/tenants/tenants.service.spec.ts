import { NotFoundException } from '@nestjs/common';
import { TenantsService } from './tenants.service.js';

describe('TenantsService security boundaries', () => {
  const user = {
    id: 'user-a',
    tenantId: 'tenant-a',
    branchIds: ['branch-a'],
    permissions: ['branch.read'],
  };

  it('always scopes branch reads to the authenticated tenant', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new TenantsService(
      { branch: { findMany } } as never,
      {} as never,
    );

    await service.getBranches(user);

    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', isActive: true },
      orderBy: { name: 'asc' },
    });
  });

  it('does not reveal a branch outside the user branch assignment', async () => {
    const service = new TenantsService(
      {
        branch: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'branch-b',
            tenantId: 'tenant-a',
            isActive: true,
          }),
        },
      } as never,
      {} as never,
    );

    await expect(service.getBranch(user, 'branch-b')).rejects.toThrow(NotFoundException);
  });
});
