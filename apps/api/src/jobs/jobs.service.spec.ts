import { ConflictException, NotFoundException } from '@nestjs/common';
import { JobsService } from './jobs.service.js';

describe('JobsService', () => {
  const user = {
    id: 'owner-a',
    tenantId: 'tenant-a',
    branchIds: ['branch-a'],
    permissions: ['notifications.read', 'jobs.manage'],
  };

  it('scopes notification reads to the current tenant and user', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new JobsService({ notification: { findMany } } as never, {} as never);

    await service.listNotifications(user, { unreadOnly: true });

    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', userId: 'owner-a', readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  it('rejects unsupported job types before queueing', async () => {
    const service = new JobsService({} as never, {} as never);

    await expect(service.enqueue(user, { jobType: 'DELETE_TENANT', dedupeKey: 'bad-job' })).rejects.toThrow(ConflictException);
  });

  it('does not mark another user tenant notification as read', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new JobsService({ notification: { findFirst } } as never, {} as never);

    await expect(service.markRead(user, 'notification-other')).rejects.toThrow(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'notification-other', tenantId: 'tenant-a', userId: 'owner-a' } });
  });
});
