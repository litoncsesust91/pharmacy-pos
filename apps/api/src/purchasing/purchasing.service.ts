import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreatePurchaseOrderDto,
  CreatePurchaseReturnDto,
  PaySupplierDto,
  PurchaseOrderQueryDto,
  ReceivePurchaseOrderDto,
  ReviewPurchaseOrderDto,
  ReviewPurchaseReturnDto,
  UpdateSupplierTermsDto,
} from './dto/purchasing.dto.js';

const orderInclude = {
  supplier: true,
  branch: true,
  lines: { include: { product: true } },
  receipts: { orderBy: { receivedAt: 'desc' as const } },
} satisfies Prisma.PurchaseOrderInclude;

const returnInclude = {
  supplier: true,
  branch: true,
  lines: { include: { product: true, batch: true } },
} satisfies Prisma.PurchaseReturnInclude;

@Injectable()
export class PurchasingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getSupplierTerms(user: AuthenticatedUser, supplierId: string) {
    return this.getSupplier(user, supplierId);
  }

  async updateSupplierTerms(
    user: AuthenticatedUser,
    supplierId: string,
    input: UpdateSupplierTermsDto,
  ) {
    await this.getSupplier(user, supplierId);
    const supplier = await this.prisma.supplier.update({
      where: { id: supplierId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
        ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
        ...(input.paymentTermsDays !== undefined ? { paymentTermsDays: input.paymentTermsDays } : {}),
        ...(input.creditLimit !== undefined ? { creditLimit: input.creditLimit } : {}),
      },
    });
    await this.recordAudit(user, 'supplier.terms.updated', supplier.id, { fields: Object.keys(input) });
    return supplier;
  }

  listOrders(user: AuthenticatedUser, query: PurchaseOrderQueryDto) {
    if (query.branchId) this.assertBranch(user, query.branchId);
    return this.prisma.purchaseOrder.findMany({
      where: {
        tenantId: user.tenantId,
        branchId: query.branchId ? query.branchId : { in: user.branchIds },
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOrder(user: AuthenticatedUser, input: CreatePurchaseOrderDto) {
    this.assertBranch(user, input.branchId);
    const supplier = await this.getSupplier(user, input.supplierId);
    const productIds = input.lines.map((line) => line.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('Purchase order products must be unique');
    }
    const products = await this.prisma.product.findMany({
      where: { tenantId: user.tenantId, id: { in: productIds }, isActive: true },
      select: { id: true },
    });
    if (products.length !== productIds.length) throw new NotFoundException('Product not found');

    const totals = this.calculateTotals(input.lines);
    try {
      const order = await this.prisma.purchaseOrder.create({
        data: {
          tenantId: user.tenantId,
          branchId: input.branchId,
          supplierId: supplier.id,
          orderNumber: input.orderNumber.trim(),
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          requestedById: user.id,
          lines: {
            create: input.lines.map((line) => ({
              productId: line.productId,
              orderedQuantity: line.quantity,
              unitCost: line.unitCost,
              taxRate: line.taxRate,
              lineTotal: this.lineTotal(line.quantity, line.unitCost, line.taxRate),
            })),
          },
        },
        include: orderInclude,
      });
      await this.recordAudit(user, 'purchase-order.created', order.id, {
        orderNumber: order.orderNumber,
        total: order.total.toString(),
      });
      return order;
    } catch (error) {
      this.throwConflict(error, 'Purchase order number already exists');
    }
  }

  async submitOrder(user: AuthenticatedUser, orderId: string) {
    const order = await this.getOrder(user, orderId);
    if (order.requestedById !== user.id) throw new ForbiddenException('Only the requester can submit this order');
    if (order.status !== 'DRAFT') throw new BadRequestException('Only draft orders can be submitted');
    const updated = await this.prisma.purchaseOrder.update({
      where: { id: order.id },
      data: { status: 'PENDING_APPROVAL' },
      include: orderInclude,
    });
    await this.recordAudit(user, 'purchase-order.submitted', order.id, {});
    return updated;
  }

  async reviewOrder(user: AuthenticatedUser, orderId: string, input: ReviewPurchaseOrderDto) {
    const order = await this.getOrder(user, orderId);
    if (order.requestedById === user.id) throw new ForbiddenException('Requester cannot approve their own order');
    if (order.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only pending orders can be reviewed');
    }
    const updated = await this.prisma.purchaseOrder.update({
      where: { id: order.id },
      data: {
        status: input.approved ? 'APPROVED' : 'REJECTED',
        approvedById: user.id,
        approvedAt: new Date(),
        approvalNote: input.note?.trim(),
      },
      include: orderInclude,
    });
    await this.recordAudit(user, input.approved ? 'purchase-order.approved' : 'purchase-order.rejected', order.id, {
      note: input.note,
    });
    return updated;
  }

  async receiveOrder(user: AuthenticatedUser, orderId: string, input: ReceivePurchaseOrderDto) {
    const order = await this.getOrder(user, orderId);
    if (order.status !== 'APPROVED' && order.status !== 'PARTIALLY_RECEIVED') {
      throw new BadRequestException('Only approved orders can be received');
    }
    const lineIds = input.lines.map((line) => line.purchaseOrderLineId);
    if (new Set(lineIds).size !== lineIds.length) throw new BadRequestException('Receipt lines must be unique');
    const orderLines = new Map(order.lines.map((line) => [line.id, line]));
    for (const line of input.lines) {
      const orderLine = orderLines.get(line.purchaseOrderLineId);
      if (!orderLine) throw new NotFoundException('Purchase order line not found');
      if (line.quantity > orderLine.orderedQuantity - orderLine.receivedQuantity) {
        throw new BadRequestException('Received quantity exceeds the outstanding quantity');
      }
      if (line.unitCost !== Number(orderLine.unitCost)) {
        throw new BadRequestException('Received cost must match the approved purchase order cost');
      }
      this.assertValidBatchDates(line.expiryDate, line.manufacturingDate);
    }
    const total = input.lines.reduce(
      (sum, line) => sum + this.lineTotal(line.quantity, line.unitCost, orderLines.get(line.purchaseOrderLineId)!.taxRate.toNumber()),
      0,
    );

    try {
      const receipt = await this.prisma.$transaction(
        async (transaction) => {
          const existing = await transaction.purchaseReceipt.findUnique({
            where: { tenantId_idempotencyKey: { tenantId: user.tenantId, idempotencyKey: input.idempotencyKey } },
            include: { lines: true },
          });
          if (existing) return existing;

          const created = await transaction.purchaseReceipt.create({
            data: {
              tenantId: user.tenantId,
              branchId: order.branchId,
              supplierId: order.supplierId,
              purchaseOrderId: order.id,
              receiptNumber: input.receiptNumber.trim(),
              total,
              receivedById: user.id,
              idempotencyKey: input.idempotencyKey,
            },
          });
          for (const line of input.lines) {
            const orderLine = orderLines.get(line.purchaseOrderLineId)!;
            const expiryDate = new Date(line.expiryDate);
            const manufacturingDate = line.manufacturingDate ? new Date(line.manufacturingDate) : undefined;
            let batch = await transaction.inventoryBatch.findUnique({
              where: {
                tenantId_branchId_productId_batchNumber: {
                  tenantId: user.tenantId,
                  branchId: order.branchId,
                  productId: orderLine.productId,
                  batchNumber: line.batchNumber.trim(),
                },
              },
            });
            if (batch) {
              if (batch.expiryDate.getTime() !== expiryDate.getTime() || batch.purchaseCost.toNumber() !== line.unitCost) {
                throw new BadRequestException('Existing batch details do not match the receipt');
              }
              const updated = await transaction.inventoryBatch.update({
                where: { id: batch.id },
                data: { quantity: { increment: line.quantity } },
              });
              batch = updated;
            } else {
              batch = await transaction.inventoryBatch.create({
                data: {
                  tenantId: user.tenantId,
                  branchId: order.branchId,
                  productId: orderLine.productId,
                  batchNumber: line.batchNumber.trim(),
                  manufacturingDate,
                  expiryDate,
                  purchaseCost: line.unitCost,
                  sellingPrice: line.sellingPrice,
                  quantity: line.quantity,
                },
              });
            }
            await transaction.stockLedgerEntry.create({
              data: {
                tenantId: user.tenantId,
                branchId: order.branchId,
                batchId: batch.id,
                productId: orderLine.productId,
                actorId: user.id,
                movementType: 'PURCHASE_RECEIVE',
                quantityDelta: line.quantity,
                resultingQuantity: batch.quantity,
                idempotencyKey: `${input.idempotencyKey}:${line.purchaseOrderLineId}`,
              },
            });
            await transaction.purchaseReceiptLine.create({
              data: {
                receiptId: created.id,
                purchaseOrderLineId: orderLine.id,
                productId: orderLine.productId,
                batchId: batch.id,
                quantity: line.quantity,
                unitCost: line.unitCost,
                taxRate: orderLine.taxRate,
                lineTotal: this.lineTotal(line.quantity, line.unitCost, orderLine.taxRate.toNumber()),
              },
            });
            await transaction.purchaseOrderLine.update({
              where: { id: orderLine.id },
              data: { receivedQuantity: { increment: line.quantity } },
            });
          }
          const receivedLines = await transaction.purchaseOrderLine.findMany({
            where: { purchaseOrderId: order.id },
            select: { orderedQuantity: true, receivedQuantity: true },
          });
          const fullyReceived = receivedLines.every(
            (line) => line.receivedQuantity >= line.orderedQuantity,
          );
          await transaction.purchaseOrder.update({
            where: { id: order.id },
            data: { status: fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED' },
          });
          await transaction.supplierPayable.create({
            data: {
              tenantId: user.tenantId,
              supplierId: order.supplierId,
              purchaseOrderId: order.id,
              receiptId: created.id,
              referenceType: 'PURCHASE_RECEIPT',
              amount: total,
              dueDate: new Date(Date.now() + order.supplier.paymentTermsDays * 86400000),
            },
          });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.recordAudit(user, 'purchase.received', receipt.id, {
        orderId: order.id,
        total,
      });
      return receipt;
    } catch (error) {
      this.throwConflict(error, 'Receipt number or idempotency key already exists');
    }
  }

  listReturns(user: AuthenticatedUser) {
    return this.prisma.purchaseReturn.findMany({
      where: { tenantId: user.tenantId, branchId: { in: user.branchIds } },
      include: returnInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createReturn(user: AuthenticatedUser, input: CreatePurchaseReturnDto) {
    this.assertBranch(user, input.branchId);
    const supplier = await this.getSupplier(user, input.supplierId);
    const batchIds = input.lines.map((line) => line.batchId);
    if (new Set(batchIds).size !== batchIds.length) throw new BadRequestException('Return batches must be unique');
    const batches = await this.prisma.inventoryBatch.findMany({
      where: { id: { in: batchIds }, tenantId: user.tenantId, branchId: input.branchId },
    });
    if (batches.length !== batchIds.length) throw new NotFoundException('Batch not found');
    const byId = new Map(batches.map((batch) => [batch.id, batch]));
    for (const line of input.lines) {
      if (line.quantity > byId.get(line.batchId)!.quantity) throw new BadRequestException('Return exceeds available stock');
    }
    const order = input.purchaseOrderId
      ? await this.getOrder(user, input.purchaseOrderId)
      : undefined;
    if (order) {
      if (order.supplierId !== supplier.id || order.branchId !== input.branchId) {
        throw new BadRequestException('Purchase order does not match the return');
      }
    }
    for (const line of input.lines) {
      if (line.purchaseOrderLineId) {
        const orderLine = order?.lines.find(({ id }) => id === line.purchaseOrderLineId);
        if (!orderLine || orderLine.productId !== byId.get(line.batchId)!.productId) {
          throw new BadRequestException('Purchase return line does not match the purchase order');
        }
      }
    }
    const total = input.lines.reduce((sum, line) => sum + line.quantity * byId.get(line.batchId)!.purchaseCost.toNumber(), 0);
    try {
      const result = await this.prisma.purchaseReturn.create({
        data: {
          tenantId: user.tenantId,
          branchId: input.branchId,
          supplierId: supplier.id,
          purchaseOrderId: input.purchaseOrderId,
          returnNumber: input.returnNumber.trim(),
          status: 'PENDING_APPROVAL',
          total,
          reason: input.reason.trim(),
          requestedById: user.id,
          idempotencyKey: input.idempotencyKey,
          lines: {
            create: input.lines.map((line) => ({
              purchaseOrderLineId: line.purchaseOrderLineId,
              productId: byId.get(line.batchId)!.productId,
              batchId: line.batchId,
              quantity: line.quantity,
              unitCost: byId.get(line.batchId)!.purchaseCost,
              lineTotal: line.quantity * byId.get(line.batchId)!.purchaseCost.toNumber(),
            })),
          },
        },
        include: returnInclude,
      });
      await this.recordAudit(user, 'purchase-return.created', result.id, { total, reason: input.reason });
      return result;
    } catch (error) {
      this.throwConflict(error, 'Return number or idempotency key already exists');
    }
  }

  async reviewReturn(user: AuthenticatedUser, returnId: string, input: ReviewPurchaseReturnDto) {
    const purchaseReturn = await this.getReturn(user, returnId);
    if (purchaseReturn.requestedById === user.id) throw new ForbiddenException('Requester cannot approve their own return');
    if (purchaseReturn.status !== 'PENDING_APPROVAL') throw new BadRequestException('Only pending returns can be reviewed');
    const updated = await this.prisma.purchaseReturn.update({
      where: { id: returnId },
      data: { status: input.approved ? 'APPROVED' : 'REJECTED', approvedById: user.id, approvedAt: new Date() },
      include: returnInclude,
    });
    await this.recordAudit(user, input.approved ? 'purchase-return.approved' : 'purchase-return.rejected', returnId, { note: input.note });
    return updated;
  }

  async completeReturn(user: AuthenticatedUser, returnId: string) {
    const purchaseReturn = await this.getReturn(user, returnId);
    this.assertBranch(user, purchaseReturn.branchId);
    if (purchaseReturn.status !== 'APPROVED') throw new BadRequestException('Only approved returns can be completed');
    const result = await this.prisma.$transaction(async (transaction) => {
      for (const line of purchaseReturn.lines) {
        const updated = await transaction.inventoryBatch.updateMany({
          where: { id: line.batchId, quantity: { gte: line.quantity } },
          data: { quantity: { decrement: line.quantity } },
        });
        if (updated.count !== 1) throw new BadRequestException('Insufficient stock for return');
        const batch = await transaction.inventoryBatch.findUniqueOrThrow({ where: { id: line.batchId } });
        await transaction.stockLedgerEntry.create({
          data: {
            tenantId: user.tenantId,
            branchId: purchaseReturn.branchId,
            batchId: line.batchId,
            productId: line.productId,
            actorId: user.id,
            movementType: 'PURCHASE_RETURN',
            quantityDelta: -line.quantity,
            resultingQuantity: batch.quantity,
            idempotencyKey: `${purchaseReturn.idempotencyKey}:${line.id}`,
          },
        });
      }
      const updatedReturn = await transaction.purchaseReturn.update({
        where: { id: returnId },
        data: { status: 'COMPLETED', completedAt: new Date() },
        include: returnInclude,
      });
      await transaction.supplierPayable.create({
        data: {
          tenantId: user.tenantId,
          supplierId: purchaseReturn.supplierId,
          returnId,
          referenceType: 'PURCHASE_RETURN',
          amount: purchaseReturn.total.neg(),
          status: 'CREDIT',
        },
      });
      return updatedReturn;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.recordAudit(user, 'purchase-return.completed', returnId, { total: purchaseReturn.total.toString() });
    return result;
  }

  listPayables(user: AuthenticatedUser) {
    return this.prisma.supplierPayable.findMany({
      where: { tenantId: user.tenantId },
      include: { supplier: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async paySupplier(user: AuthenticatedUser, payableId: string, input: PaySupplierDto) {
    const payable = await this.prisma.supplierPayable.findFirst({ where: { id: payableId, tenantId: user.tenantId } });
    if (!payable) throw new NotFoundException('Supplier payable not found');
    if (payable.amount.lessThanOrEqualTo(payable.paidAmount)) {
      throw new BadRequestException('Payable is already settled or is a credit');
    }
    const remaining = payable.amount.sub(payable.paidAmount);
    if (new Prisma.Decimal(input.amount).greaterThan(remaining)) throw new BadRequestException('Payment exceeds payable balance');
    const result = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.supplierPayment.findUnique({
        where: { tenantId_idempotencyKey: { tenantId: user.tenantId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) return existing;
      const payment = await transaction.supplierPayment.create({
        data: { tenantId: user.tenantId, supplierId: payable.supplierId, payableId, amount: input.amount, idempotencyKey: input.idempotencyKey },
      });
      const paidAmount = payable.paidAmount.add(input.amount);
      await transaction.supplierPayable.update({
        where: { id: payableId },
        data: { paidAmount, status: paidAmount.equals(payable.amount) ? 'PAID' : 'PARTIALLY_PAID' },
      });
      return payment;
    });
    await this.recordAudit(user, 'supplier-payable.paid', payableId, { amount: input.amount });
    return result;
  }

  private async getSupplier(user: AuthenticatedUser, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, tenantId: user.tenantId, isActive: true } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  private async getOrder(user: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.purchaseOrder.findFirst({ where: { id: orderId, tenantId: user.tenantId, branchId: { in: user.branchIds } }, include: orderInclude });
    if (!order) throw new NotFoundException('Purchase order not found');
    return order;
  }

  private async getReturn(user: AuthenticatedUser, returnId: string) {
    const purchaseReturn = await this.prisma.purchaseReturn.findFirst({ where: { id: returnId, tenantId: user.tenantId, branchId: { in: user.branchIds } }, include: returnInclude });
    if (!purchaseReturn) throw new NotFoundException('Purchase return not found');
    return purchaseReturn;
  }

  private assertBranch(user: AuthenticatedUser, branchId: string) {
    if (!user.branchIds.includes(branchId)) throw new ForbiddenException('Branch access denied');
  }

  private calculateTotals(lines: CreatePurchaseOrderDto['lines']) {
    const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
    const taxTotal = lines.reduce((sum, line) => sum + line.quantity * line.unitCost * line.taxRate / 100, 0);
    return { subtotal: this.money(subtotal), taxTotal: this.money(taxTotal), total: this.money(subtotal + taxTotal) };
  }

  private lineTotal(quantity: number, unitCost: number, taxRate: number) {
    return this.money(quantity * unitCost * (1 + taxRate / 100));
  }

  private money(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private assertValidBatchDates(expiry: string, manufacturing?: string) {
    const expiryDate = new Date(expiry);
    if (expiryDate <= new Date()) throw new BadRequestException('Batch expiry must be in the future');
    if (manufacturing && new Date(manufacturing) >= expiryDate) throw new BadRequestException('Manufacturing date must precede expiry date');
  }

  private async recordAudit(user: AuthenticatedUser, action: string, entityId: string, metadata: Prisma.InputJsonObject) {
    await this.audit.record({ tenantId: user.tenantId, actorId: user.id, action, entityType: 'Purchasing', entityId, metadata });
  }

  private throwConflict(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(message);
    throw error;
  }
}
