import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateBranchDto } from './dto/create-branch.dto.js';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  getCurrent(user: AuthenticatedUser) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      include: { branches: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    });
  }

  getBranches(user: AuthenticatedUser) {
    return this.prisma.branch.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createBranch(user: AuthenticatedUser, input: CreateBranchDto) {
    const code = input.code.trim().toUpperCase();
    const existing = await this.prisma.branch.findUnique({
      where: { tenantId_code: { tenantId: user.tenantId, code } },
    });
    if (existing) throw new ConflictException('Branch code already exists');

    const branch = await this.prisma.branch.create({
      data: { tenantId: user.tenantId, name: input.name.trim(), code },
    });
    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'branch.created',
      entityType: 'Branch',
      entityId: branch.id,
      metadata: { code: branch.code },
    });
    return branch;
  }

  async getBranch(user: AuthenticatedUser, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId: user.tenantId, isActive: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (!user.branchIds.includes(branchId)) throw new NotFoundException('Branch not found');
    return branch;
  }
}
