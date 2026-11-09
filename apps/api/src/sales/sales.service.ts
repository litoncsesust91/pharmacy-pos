import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateCustomerDto,
  CreateSaleDto,
  CustomerQueryDto,
  SaleQueryDto,
} from './dto/sales.dto.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';

const saleInclude = {
  customer: true,
  branch: true,
  lines: { include: { product: true, batch: true } },
} satisfies Prisma.SaleInclude;

type SaleDetail = {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
};

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly subscriptions?: SubscriptionsService,
  ) {}

  listCustomers(user: AuthenticatedUser, query: CustomerQueryDto) {
    return this.prisma.customer.findMany({
      where: {
        tenantId: user.tenantId,
        ...(query.search
          ? {
              OR: [
                { firstName: { contains: query.search, mode: 'insensitive' as const } },
                { lastName: { contains: query.search, mode: 'insensitive' as const } },
                { phone: { contains: query.search, mode: 'insensitive' as const } },
                { email: { contains: query.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { firstName: 'asc' },
      take: 50,
    });
  }

  async createCustomer(user: AuthenticatedUser, input: CreateCustomerDto) {
    const customer = await this.prisma.customer.create({
      data: {
        tenantId: user.tenantId,
        firstName: input.firstName.trim(),
        lastName: input.lastName?.trim(),
        phone: input.phone?.trim(),
        email: input.email?.trim().toLowerCase(),
      },
    });
    await this.recordAudit(user, 'customer.created', customer.id, { firstName: customer.firstName });
    return customer;
  }

  listSales(user: AuthenticatedUser, query: SaleQueryDto) {
    if (query.branchId) this.assertBranch(user, query.branchId);
    return this.prisma.sale.findMany({
      where: {
        tenantId: user.tenantId,
        branchId: query.branchId ? query.branchId : { in: user.branchIds },
        ...(query.status ? { status: query.status } : {}),
      },
      include: saleInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getSale(user: AuthenticatedUser, saleId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId: user.tenantId, branchId: { in: user.branchIds } },
      include: saleInclude,
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  async createSale(user: AuthenticatedUser, input: CreateSaleDto) {
    await this.subscriptions?.assertWithinLimit(user, 'monthlySales');
    this.assertBranch(user, input.branchId);
    const existing = await this.prisma.sale.findUnique({
      where: { tenantId_idempotencyKey: { tenantId: user.tenantId, idempotencyKey: input.idempotencyKey } },
      include: saleInclude,
    });
    if (existing) return existing;

    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId: user.tenantId } });
    if (!settings) throw new NotFoundException('Tenant settings not found');
    const products = await this.prisma.product.findMany({
      where: { tenantId: user.tenantId, id: { in: input.lines.map((line) => line.productId) }, isActive: true },
    });
    if (products.length !== new Set(input.lines.map((line) => line.productId)).size) {
      throw new NotFoundException('Product not found');
    }
    if (input.customerId) {
      const customer = await this.prisma.customer.findFirst({ where: { id: input.customerId, tenantId: user.tenantId } });
      if (!customer) throw new NotFoundException('Customer not found');
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const requiresPrescription = products.some((product) => product.prescriptionRequired || product.controlledDrug);
    if (products.some((product) => product.controlledDrug) && !settings.controlledDrugsEnabled) {
      throw new ForbiddenException('Controlled products are disabled by tenant policy');
    }
    if (requiresPrescription && (settings.prescriptionApprovalRequired || settings.controlledApprovalRequired)) {
      if (!input.prescriptionId) throw new ForbiddenException('Approved prescription required');
      const prescription = await this.prisma.prescription.findFirst({
        where: {
          id: input.prescriptionId,
          tenantId: user.tenantId,
          customerId: input.customerId,
          status: 'APPROVED',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: { lines: true },
      });
      if (!prescription) throw new ForbiddenException('Approved prescription not found or expired');
      for (const line of input.lines) {
        const product = productMap.get(line.productId)!;
        if (product.prescriptionRequired || product.controlledDrug) {
          const authorization = prescription.lines.find(({ productId }) => productId === line.productId);
          if (!authorization || (authorization.authorizedQuantity !== null && line.quantity > authorization.authorizedQuantity)) {
            throw new ForbiddenException('Prescription does not authorize this product or quantity');
          }
        }
      }
    }

    const details: SaleDetail[] = input.lines.map((line) => {
      const product = productMap.get(line.productId)!;
      const unitPrice = product.sellingPrice.toNumber();
      const discountAmount = line.discountAmount ?? 0;
      if (discountAmount > unitPrice * line.quantity) {
        throw new BadRequestException('Discount exceeds line value');
      }
      if (input.channel === 'OFFLINE' &&
        (product.prescriptionRequired || product.controlledDrug) &&
        !settings.offlineHighRiskSalesAllowed) {
        throw new ForbiddenException('This product requires an online sale');
      }
      return {
        productId: line.productId,
        quantity: line.quantity,
        unitPrice,
        discountAmount,
        taxRate: settings.taxEnabled ? settings.taxRate.toNumber() : 0,
      };
    });
    const totals = this.calculateTotals(details);
    const status = input.status ?? 'COMPLETED';
    const clientCreatedAt = input.clientCreatedAt ? new Date(input.clientCreatedAt) : undefined;

    try {
      const sale = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.sale.create({
          data: {
            tenantId: user.tenantId,
            branchId: input.branchId,
            cashierId: user.id,
            customerId: input.customerId,
            saleNumber: input.saleNumber.trim(),
            receiptNumber: `RCPT-${input.saleNumber.trim()}`,
            idempotencyKey: input.idempotencyKey,
            status,
            channel: input.channel,
            subtotal: totals.subtotal,
            discountTotal: totals.discountTotal,
            taxTotal: totals.taxTotal,
            total: totals.total,
            paymentMethod: input.paymentMethod,
            prescriptionId: input.prescriptionId,
            clientCreatedAt,
          },
        });
        if (status === 'SUSPENDED') {
          for (const detail of details) {
            await this.createSaleLine(transaction, created.id, detail, undefined);
          }
        } else {
          for (const detail of details) {
            const allocations = await this.allocate(transaction, user, created.id, input.branchId, detail);
            for (const allocation of allocations) {
              await this.createSaleLine(transaction, created.id, detail, allocation);
            }
          }
        }
        return transaction.sale.findUniqueOrThrow({ where: { id: created.id }, include: saleInclude });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await this.recordAudit(user, status === 'SUSPENDED' ? 'sale.suspended' : 'sale.completed', sale.id, {
        channel: input.channel,
        total: sale.total.toString(),
      });
      return sale;
    } catch (error) {
      this.throwConflict(error, 'Sale number, receipt number, or idempotency key already exists');
    }
  }

  async resumeSale(user: AuthenticatedUser, saleId: string) {
    const suspended = await this.getSale(user, saleId);
    if (suspended.status !== 'SUSPENDED') throw new BadRequestException('Only suspended sales can be resumed');
    const sale = await this.prisma.$transaction(async (transaction) => {
      await transaction.saleLine.deleteMany({ where: { saleId: saleId } });
      for (const line of suspended.lines) {
        const detail: SaleDetail = {
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice.toNumber(),
          discountAmount: line.discountAmount.toNumber(),
          taxRate: line.taxRate.toNumber(),
        };
        const allocations = await this.allocate(transaction, user, saleId, suspended.branchId, detail);
        for (const allocation of allocations) await this.createSaleLine(transaction, saleId, detail, allocation);
      }
      return transaction.sale.update({ where: { id: saleId }, data: { status: 'COMPLETED' }, include: saleInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.recordAudit(user, 'sale.resumed', sale.id, { total: sale.total.toString() });
    return sale;
  }

  private async allocate(
    transaction: Prisma.TransactionClient,
    user: AuthenticatedUser,
    saleId: string,
    branchId: string,
    detail: SaleDetail,
  ) {
    const batches = await transaction.inventoryBatch.findMany({
      where: {
        tenantId: user.tenantId,
        branchId,
        productId: detail.productId,
        quantity: { gt: 0 },
        expiryDate: { gt: new Date() },
        status: 'AVAILABLE',
        recalled: false,
        quarantined: false,
      },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });
    let remaining = detail.quantity;
    const allocations: Array<{ batchId: string; quantity: number }> = [];
    for (const batch of batches) {
      if (remaining === 0) break;
      const quantity = Math.min(remaining, batch.quantity);
      const updated = await transaction.inventoryBatch.updateMany({
        where: { id: batch.id, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });
      if (updated.count !== 1) throw new ConflictException('Stock changed; retry the sale');
      const current = batch.quantity - quantity;
      await transaction.stockLedgerEntry.create({
        data: {
          tenantId: user.tenantId,
          branchId,
          batchId: batch.id,
          productId: detail.productId,
          actorId: user.id,
          movementType: 'SALE',
          quantityDelta: -quantity,
          resultingQuantity: current,
          idempotencyKey: `sale:${saleId}:${batch.id}`,
        },
      });
      allocations.push({ batchId: batch.id, quantity });
      remaining -= quantity;
    }
    if (remaining > 0) throw new BadRequestException('Insufficient eligible stock');
    return allocations;
  }

  private async createSaleLine(
    transaction: Prisma.TransactionClient,
    saleId: string,
    detail: SaleDetail,
    allocation: { batchId: string; quantity: number } | undefined,
  ) {
    const quantity = allocation?.quantity ?? detail.quantity;
    const discountAmount = this.money(detail.discountAmount * quantity / detail.quantity);
    const taxable = detail.unitPrice * quantity - discountAmount;
    const taxAmount = this.money(taxable * detail.taxRate / 100);
    const product = await transaction.product.findUniqueOrThrow({ where: { id: detail.productId } });
    return transaction.saleLine.create({
      data: {
        saleId,
        productId: detail.productId,
        batchId: allocation?.batchId,
        productName: product.name,
        sku: product.sku,
        quantity,
        unitPrice: detail.unitPrice,
        discountAmount,
        taxRate: detail.taxRate,
        taxAmount,
        lineTotal: this.money(taxable + taxAmount),
      },
    });
  }

  private calculateTotals(details: SaleDetail[]) {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    for (const detail of details) {
      subtotal += detail.unitPrice * detail.quantity;
      discountTotal += detail.discountAmount;
      taxTotal += (detail.unitPrice * detail.quantity - detail.discountAmount) * detail.taxRate / 100;
    }
    return {
      subtotal: this.money(subtotal),
      discountTotal: this.money(discountTotal),
      taxTotal: this.money(taxTotal),
      total: this.money(subtotal - discountTotal + taxTotal),
    };
  }

  private assertBranch(user: AuthenticatedUser, branchId: string) {
    if (!user.branchIds.includes(branchId)) throw new ForbiddenException('Branch access denied');
  }

  private money(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async recordAudit(user: AuthenticatedUser, action: string, entityId: string, metadata: Prisma.InputJsonObject) {
    await this.audit.record({ tenantId: user.tenantId, actorId: user.id, action, entityType: 'Sale', entityId, metadata });
  }

  private throwConflict(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(message);
    throw error;
  }
}
