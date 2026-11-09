import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import {
  CreateCustomerDto,
  CreateSaleDto,
  CustomerQueryDto,
  SaleQueryDto,
} from './dto/sales.dto.js';
import { SalesService } from './sales.service.js';

@ApiTags('sales')
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get('customers')
  @RequirePermissions('sales.read')
  listCustomers(@CurrentUser() user: AuthenticatedUser, @Query() query: CustomerQueryDto) {
    return this.sales.listCustomers(user, query);
  }

  @Post('customers')
  @RequirePermissions('sales.manage')
  createCustomer(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateCustomerDto) {
    return this.sales.createCustomer(user, input);
  }

  @Get()
  @RequirePermissions('sales.read')
  listSales(@CurrentUser() user: AuthenticatedUser, @Query() query: SaleQueryDto) {
    return this.sales.listSales(user, query);
  }

  @Get(':saleId')
  @RequirePermissions('sales.read')
  getSale(@CurrentUser() user: AuthenticatedUser, @Param('saleId') saleId: string) {
    return this.sales.getSale(user, saleId);
  }

  @Post()
  @RequirePermissions('sales.create')
  createSale(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateSaleDto) {
    return this.sales.createSale(user, input);
  }

  @Post(':saleId/resume')
  @RequirePermissions('sales.create')
  resumeSale(@CurrentUser() user: AuthenticatedUser, @Param('saleId') saleId: string) {
    return this.sales.resumeSale(user, saleId);
  }
}
