import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(input: LoginDto): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: input.email.toLowerCase(),
        tenant: { slug: input.tenantSlug, isActive: true },
        isActive: true,
      },
      include: {
        userBranches: true,
        userRoles: {
          include: {
            role: { include: { rolePermissions: { include: { permission: true } } } },
          },
        },
      },
    });

    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.assertSubscription(user.tenantId);

    const authenticatedUser = this.toAuthenticatedUser(user);
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      tenantId: user.tenantId,
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'auth.login.succeeded',
      entityType: 'User',
      entityId: user.id,
    });

    return { accessToken, user: authenticatedUser };
  }

  async getAuthenticatedUser(userId: string, tenantId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, isActive: true, tenant: { isActive: true } },
      include: {
        userBranches: true,
        userRoles: {
          include: {
            role: { include: { rolePermissions: { include: { permission: true } } } },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User is not active or no longer exists');
    }
    await this.assertSubscription(user.tenantId);

    return this.toAuthenticatedUser(user);
  }

  private toAuthenticatedUser(user: {
    id: string;
    tenantId: string;
    userBranches: { branchId: string }[];
    userRoles: { role: { rolePermissions: { permission: { key: string } }[] } }[];
  }): AuthenticatedUser {
    return {
      id: user.id,
      tenantId: user.tenantId,
      branchIds: user.userBranches.map(({ branchId }) => branchId),
      permissions: [
        ...new Set(
          user.userRoles.flatMap(({ role }) =>
            role.rolePermissions.map(({ permission }) => permission.key),
          ),
        ),
      ],
    };
  }

  private async assertSubscription(tenantId: string) {
    const subscription = await this.prisma.tenantSubscription.findUnique({ where: { tenantId }, select: { status: true, trialEndsAt: true, currentPeriodEnd: true } });
    if (!subscription) throw new UnauthorizedException('Tenant subscription is not configured');
    const now = new Date();
    const expired = (subscription.status === 'TRIALING' && !!subscription.trialEndsAt && subscription.trialEndsAt <= now) || (subscription.status === 'ACTIVE' && subscription.currentPeriodEnd <= now);
    if (expired || ['SUSPENDED', 'CANCELED'].includes(subscription.status)) throw new UnauthorizedException('Tenant subscription is not active');
  }
}
