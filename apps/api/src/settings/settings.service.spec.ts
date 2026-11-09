import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service.js';

describe('SettingsService', () => {
  const user = {
    id: 'owner-a',
    tenantId: 'tenant-a',
    branchIds: ['branch-a'],
    permissions: ['settings.read', 'settings.manage'],
  };

  it('scopes settings reads to the authenticated tenant', async () => {
    const findUniqueOrThrow = jest.fn().mockResolvedValue({ tenantId: 'tenant-a' });
    const service = new SettingsService(
      { tenantSettings: { findUniqueOrThrow } } as never,
      {} as never,
    );

    await service.getSettings(user);

    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
      include: {
        countryProfile: true,
        paymentMethods: { orderBy: { sortOrder: 'asc' } },
      },
    });
  });

  it('rejects an unsupported country before changing settings', async () => {
    const update = jest.fn();
    const service = new SettingsService(
      {
        tenantSettings: {
          findUnique: jest.fn().mockResolvedValue({ id: 'settings-a', tenantId: 'tenant-a' }),
        },
        countryProfile: { findUnique: jest.fn().mockResolvedValue(null) },
        $transaction: update,
      } as never,
      {} as never,
    );

    await expect(service.updateSettings(user, { countryCode: 'ZZ' })).rejects.toThrow(
      BadRequestException,
    );
    expect(update).not.toHaveBeenCalled();
  });
});
