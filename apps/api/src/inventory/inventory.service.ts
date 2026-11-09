import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type {
  AllocateStockDto,
  CreateBatchDto,
  InventoryQueryDto,
  StockMovementDto,
  UpdateBatchStatusDto,
} from "./dto/inventory.dto.js";

const batchInclude = {
  product: true,
  branch: true,
} satisfies Prisma.InventoryBatchInclude;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listBatches(user: AuthenticatedUser, query: InventoryQueryDto) {
    const branchIds = this.allowedBranches(user, query.branchId);
    return this.prisma.inventoryBatch.findMany({
      where: {
        tenantId: user.tenantId,
        branchId: { in: branchIds },
        ...(query.productId ? { productId: query.productId } : {}),
      },
      include: batchInclude,
      orderBy: [{ expiryDate: "asc" }, { batchNumber: "asc" }],
    });
  }

  async createBatch(user: AuthenticatedUser, input: CreateBatchDto) {
    this.assertBranch(user, input.branchId);
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, tenantId: user.tenantId, isActive: true },
    });
    if (!product) throw new NotFoundException("Product not found");

    const expiryDate = new Date(input.expiryDate);
    const manufacturingDate = input.manufacturingDate
      ? new Date(input.manufacturingDate)
      : undefined;
    if (expiryDate <= new Date())
      throw new BadRequestException("Batch expiry must be in the future");
    if (manufacturingDate && manufacturingDate >= expiryDate) {
      throw new BadRequestException(
        "Manufacturing date must precede expiry date",
      );
    }

    try {
      const batch = await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.stockLedgerEntry.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: user.tenantId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          include: { batch: { include: batchInclude } },
        });
        if (existing) return existing.batch;

        const created = await transaction.inventoryBatch.create({
          data: {
            tenantId: user.tenantId,
            branchId: input.branchId,
            productId: input.productId,
            batchNumber: input.batchNumber.trim(),
            manufacturingDate,
            expiryDate,
            purchaseCost: input.purchaseCost,
            sellingPrice: input.sellingPrice,
            quantity: input.quantity,
          },
          include: batchInclude,
        });
        await transaction.stockLedgerEntry.create({
          data: {
            tenantId: user.tenantId,
            branchId: input.branchId,
            batchId: created.id,
            productId: input.productId,
            actorId: user.id,
            movementType: "RECEIVE",
            quantityDelta: input.quantity,
            resultingQuantity: input.quantity,
            idempotencyKey: input.idempotencyKey,
          },
        });
        return created;
      });
      await this.recordAudit(user, "inventory.batch.received", batch.id, {
        batchNumber: batch.batchNumber,
        quantity: input.quantity,
      });
      return batch;
    } catch (error) {
      this.throwConflict(error, "Batch or idempotency key already exists");
    }
  }

  async allocate(user: AuthenticatedUser, input: AllocateStockDto) {
    this.assertBranch(user, input.branchId);
    const existing = await this.prisma.stockLedgerEntry.findMany({
      where: {
        tenantId: user.tenantId,
        idempotencyKey: { startsWith: `${input.idempotencyKey}:` },
      },
      include: { batch: true },
    });
    if (existing.length > 0)
      return { quantity: input.quantity, allocations: existing };

    try {
      const allocations = await this.prisma.$transaction(
        async (transaction) => {
          const batches = await transaction.inventoryBatch.findMany({
            where: {
              tenantId: user.tenantId,
              branchId: input.branchId,
              productId: input.productId,
              quantity: { gt: 0 },
              expiryDate: { gt: new Date() },
              status: "AVAILABLE",
              recalled: false,
              quarantined: false,
            },
            orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
          });
          let remaining = input.quantity;
          const result: Array<{
            batchId: string;
            quantity: number;
            expiryDate: Date;
          }> = [];
          for (const batch of batches) {
            if (remaining === 0) break;
            const quantity = Math.min(batch.quantity, remaining);
            const updated = await transaction.inventoryBatch.updateMany({
              where: { id: batch.id, quantity: { gte: quantity } },
              data: { quantity: { decrement: quantity } },
            });
            if (updated.count !== 1)
              throw new ConflictException("Stock changed; retry allocation");
            await transaction.stockLedgerEntry.create({
              data: {
                tenantId: user.tenantId,
                branchId: input.branchId,
                batchId: batch.id,
                productId: input.productId,
                actorId: user.id,
                movementType: "SALE",
                quantityDelta: -quantity,
                resultingQuantity: batch.quantity - quantity,
                idempotencyKey: `${input.idempotencyKey}:${batch.id}`,
              },
            });
            result.push({
              batchId: batch.id,
              quantity,
              expiryDate: batch.expiryDate,
            });
            remaining -= quantity;
          }
          if (remaining > 0)
            throw new BadRequestException("Insufficient eligible stock");
          return result;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.recordAudit(
        user,
        "inventory.stock.allocated",
        input.productId,
        {
          branchId: input.branchId,
          quantity: input.quantity,
          allocations,
        },
      );
      return { quantity: input.quantity, allocations };
    } catch (error) {
      this.throwConflict(
        error,
        "Stock allocation conflicted; retry the request",
      );
    }
  }

  async movement(user: AuthenticatedUser, input: StockMovementDto) {
    const batch = await this.prisma.inventoryBatch.findFirst({
      where: { id: input.batchId, tenantId: user.tenantId },
    });
    if (!batch) throw new NotFoundException("Batch not found");
    this.assertBranch(user, batch.branchId);
    if (input.quantity < 1)
      throw new BadRequestException("Quantity must be positive");
    const positive =
      input.movementType === "REFUND" || input.movementType === "ADJUSTMENT";
    const delta = positive ? input.quantity : -input.quantity;

    try {
      const entry = await this.prisma.$transaction(
        async (transaction) => {
          const existing = await transaction.stockLedgerEntry.findUnique({
            where: {
              tenantId_idempotencyKey: {
                tenantId: user.tenantId,
                idempotencyKey: input.idempotencyKey,
              },
            },
          });
          if (existing) return existing;
          const updated = await transaction.inventoryBatch.updateMany({
            where: { id: batch.id, quantity: { gte: delta < 0 ? -delta : 0 } },
            data: {
              quantity:
                delta < 0 ? { decrement: -delta } : { increment: delta },
            },
          });
          if (updated.count !== 1)
            throw new BadRequestException("Insufficient stock");
          const current = await transaction.inventoryBatch.findUniqueOrThrow({
            where: { id: batch.id },
          });
          return transaction.stockLedgerEntry.create({
            data: {
              tenantId: user.tenantId,
              branchId: batch.branchId,
              batchId: batch.id,
              productId: batch.productId,
              actorId: user.id,
              movementType: input.movementType,
              quantityDelta: delta,
              resultingQuantity: current.quantity,
              reason: input.reason?.trim(),
              idempotencyKey: input.idempotencyKey,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.recordAudit(
        user,
        `inventory.${input.movementType.toLowerCase()}`,
        batch.id,
        {
          quantity: delta,
          reason: input.reason,
        },
      );
      return entry;
    } catch (error) {
      this.throwConflict(error, "Stock movement already exists or conflicted");
    }
  }

  async updateBatchStatus(
    user: AuthenticatedUser,
    batchId: string,
    input: UpdateBatchStatusDto,
  ) {
    const batch = await this.prisma.inventoryBatch.findFirst({
      where: { id: batchId, tenantId: user.tenantId },
    });
    if (!batch) throw new NotFoundException("Batch not found");
    this.assertBranch(user, batch.branchId);
    const updated = await this.prisma.inventoryBatch.update({
      where: { id: batchId },
      data: {
        status: input.status,
        recalled: input.status === "RECALLED",
        quarantined: input.status === "QUARANTINED",
      },
      include: batchInclude,
    });
    await this.recordAudit(user, "inventory.batch.status-updated", batchId, {
      status: input.status,
    });
    return updated;
  }

  private allowedBranches(
    user: AuthenticatedUser,
    branchId?: string,
  ): string[] {
    if (branchId) this.assertBranch(user, branchId);
    return branchId ? [branchId] : user.branchIds;
  }

  private assertBranch(user: AuthenticatedUser, branchId: string): void {
    if (!user.branchIds.includes(branchId))
      throw new ForbiddenException("Branch access denied");
  }

  private async recordAudit(
    user: AuthenticatedUser,
    action: string,
    entityId: string,
    metadata: Prisma.InputJsonObject,
  ) {
    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action,
      entityType: "InventoryBatch",
      entityId,
      metadata,
    });
  }

  private throwConflict(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
