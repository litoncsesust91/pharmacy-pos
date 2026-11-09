import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaymentMethodDto, UpdateSettingsDto } from './dto/update-settings.dto.js';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  getSettings(user: AuthenticatedUser) {
    return this.prisma.tenantSettings.findUniqueOrThrow({
      where: { tenantId: user.tenantId },
      include: {
        countryProfile: true,
        paymentMethods: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  getCountryProfiles() {
    return this.prisma.countryProfile.findMany({ orderBy: { name: 'asc' } });
  }

  async updateSettings(user: AuthenticatedUser, input: UpdateSettingsDto) {
    const current = await this.prisma.tenantSettings.findUnique({
      where: { tenantId: user.tenantId },
      include: { paymentMethods: true },
    });
    if (!current) throw new NotFoundException('Tenant settings not found');

    let countryProfileId: string | undefined;
    if (input.countryCode) {
      const profile = await this.prisma.countryProfile.findUnique({
        where: { code: input.countryCode },
      });
      if (!profile) throw new BadRequestException('Unsupported country profile');
      countryProfileId = profile.id;
    }

    const updateData: Prisma.TenantSettingsUpdateInput = {
      ...(countryProfileId ? { countryProfile: { connect: { id: countryProfileId } } } : {}),
      ...(input.currencyCode ? { currencyCode: input.currencyCode } : {}),
      ...(input.timezone ? { timezone: input.timezone } : {}),
      ...(input.locale ? { locale: input.locale } : {}),
      ...(input.taxEnabled !== undefined ? { taxEnabled: input.taxEnabled } : {}),
      ...(input.taxName ? { taxName: input.taxName } : {}),
      ...(input.taxRate !== undefined ? { taxRate: input.taxRate } : {}),
      ...(input.expiryWarningDays !== undefined
        ? { expiryWarningDays: input.expiryWarningDays }
        : {}),
      ...(input.blockExpiredProducts !== undefined
        ? { blockExpiredProducts: input.blockExpiredProducts }
        : {}),
      ...(input.blockNearExpiryProducts !== undefined
        ? { blockNearExpiryProducts: input.blockNearExpiryProducts }
        : {}),
      ...(input.prescriptionRequired !== undefined
        ? { prescriptionRequired: input.prescriptionRequired }
        : {}),
      ...(input.controlledDrugsEnabled !== undefined
        ? { controlledDrugsEnabled: input.controlledDrugsEnabled }
        : {}),
      ...(input.prescriptionApprovalRequired !== undefined
        ? { prescriptionApprovalRequired: input.prescriptionApprovalRequired }
        : {}),
      ...(input.controlledApprovalRequired !== undefined
        ? { controlledApprovalRequired: input.controlledApprovalRequired }
        : {}),
      ...(input.offlineHighRiskSalesAllowed !== undefined
        ? { offlineHighRiskSalesAllowed: input.offlineHighRiskSalesAllowed }
        : {}),
      ...(input.receiptPrefix ? { receiptPrefix: input.receiptPrefix } : {}),
    };

    const settings = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.tenantSettings.update({
        where: { tenantId: user.tenantId },
        data: updateData,
      });

      if (input.paymentMethods) {
        await this.replacePaymentMethods(transaction, updated.id, input.paymentMethods);
      }

      return transaction.tenantSettings.findUniqueOrThrow({
        where: { tenantId: user.tenantId },
        include: {
          countryProfile: true,
          paymentMethods: { orderBy: { sortOrder: 'asc' } },
        },
      });
    });

    const changes = Object.fromEntries(
      Object.entries(input).filter(([key]) => key !== 'paymentMethods'),
    );
    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'tenant.settings.updated',
      entityType: 'TenantSettings',
      entityId: settings.id,
      metadata: {
        changes,
        paymentMethodsReplaced: input.paymentMethods !== undefined,
      },
    });

    return settings;
  }

  private async replacePaymentMethods(
    transaction: Prisma.TransactionClient,
    settingsId: string,
    paymentMethods: PaymentMethodDto[],
  ): Promise<void> {
    const codes = paymentMethods.map(({ code }) => code);
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException('Payment method codes must be unique');
    }

    await transaction.tenantPaymentMethod.deleteMany({ where: { settingsId } });
    if (paymentMethods.length > 0) {
      await transaction.tenantPaymentMethod.createMany({
        data: paymentMethods.map((method) => ({ settingsId, ...method })),
      });
    }
  }
}
