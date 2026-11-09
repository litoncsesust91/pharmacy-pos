import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermissions } from "../auth/auth.decorators.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import {
  AllocateStockDto,
  CreateBatchDto,
  InventoryQueryDto,
  StockMovementDto,
  UpdateBatchStatusDto,
} from "./dto/inventory.dto.js";
import { InventoryService } from "./inventory.service.js";

@ApiTags("inventory")
@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get("batches")
  @RequirePermissions("inventory.read")
  listBatches(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: InventoryQueryDto,
  ) {
    return this.inventory.listBatches(user, query);
  }

  @Post("batches")
  @RequirePermissions("inventory.receive")
  createBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateBatchDto,
  ) {
    return this.inventory.createBatch(user, input);
  }

  @Patch("batches/:batchId/status")
  @RequirePermissions("inventory.adjust")
  updateBatchStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("batchId") batchId: string,
    @Body() input: UpdateBatchStatusDto,
  ) {
    return this.inventory.updateBatchStatus(user, batchId, input);
  }

  @Post("allocate")
  @RequirePermissions("inventory.sell")
  allocate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: AllocateStockDto,
  ) {
    return this.inventory.allocate(user, input);
  }

  @Post("movements")
  @RequirePermissions("inventory.adjust")
  movement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: StockMovementDto,
  ) {
    return this.inventory.movement(user, input);
  }
}
