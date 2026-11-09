import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { InventoryService } from "./inventory.service.js";

describe("InventoryService", () => {
  const user = {
    id: "owner-a",
    tenantId: "tenant-a",
    branchIds: ["branch-a"],
    permissions: [
      "inventory.read",
      "inventory.receive",
      "inventory.sell",
      "inventory.adjust",
    ],
  };

  it("rejects access to an unassigned branch", async () => {
    const service = new InventoryService({} as never, {} as never);

    await expect(
      service.listBatches(user, { branchId: "branch-b" }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects receiving a batch that has already expired", async () => {
    const service = new InventoryService(
      {
        product: {
          findFirst: jest.fn().mockResolvedValue({ id: "product-a" }),
        },
      } as never,
      {} as never,
    );

    await expect(
      service.createBatch(user, {
        productId: "product-a",
        branchId: "branch-a",
        batchNumber: "BATCH-1",
        expiryDate: "2020-01-01",
        quantity: 10,
        purchaseCost: 1,
        sellingPrice: 2,
        idempotencyKey: "receive-1",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("does not query or allocate stock for an unauthorized branch", async () => {
    const findMany = jest.fn();
    const service = new InventoryService(
      { inventoryBatch: { findMany } } as never,
      {} as never,
    );

    await expect(
      service.allocate(user, {
        productId: "product-a",
        branchId: "branch-b",
        quantity: 1,
        idempotencyKey: "sale-1",
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
