import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import {
  CreateNamedCatalogDto,
  CreateProductDto,
  CreateSupplierDto,
  ProductImportDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/catalog.dto.js';
import { CatalogService } from './catalog.service.js';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('companies')
  @RequirePermissions('catalog.read')
  listCompanies(@CurrentUser() user: AuthenticatedUser) {
    return this.catalog.listCompanies(user);
  }

  @Post('companies')
  @RequirePermissions('catalog.manage')
  createCompany(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateNamedCatalogDto) {
    return this.catalog.createCompany(user, input);
  }

  @Get('groups')
  @RequirePermissions('catalog.read')
  listGroups(@CurrentUser() user: AuthenticatedUser) {
    return this.catalog.listGroups(user);
  }

  @Post('groups')
  @RequirePermissions('catalog.manage')
  createGroup(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateNamedCatalogDto) {
    return this.catalog.createGroup(user, input);
  }

  @Get('suppliers')
  @RequirePermissions('catalog.read')
  listSuppliers(@CurrentUser() user: AuthenticatedUser) {
    return this.catalog.listSuppliers(user);
  }

  @Post('suppliers')
  @RequirePermissions('catalog.manage')
  createSupplier(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateSupplierDto) {
    return this.catalog.createSupplier(user, input);
  }

  @Get('products')
  @RequirePermissions('catalog.read')
  listProducts(@CurrentUser() user: AuthenticatedUser, @Query() query: ProductQueryDto) {
    return this.catalog.listProducts(user, query);
  }

  @Post('products')
  @RequirePermissions('catalog.manage')
  createProduct(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateProductDto) {
    return this.catalog.createProduct(user, input);
  }

  @Post('products/import/validate')
  @RequirePermissions('catalog.manage')
  validateProductImport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ProductImportDto,
  ) {
    return this.catalog.validateProductImport(user, input);
  }

  @Get('products/:productId')
  @RequirePermissions('catalog.read')
  getProduct(@CurrentUser() user: AuthenticatedUser, @Param('productId') productId: string) {
    return this.catalog.getProduct(user, productId);
  }

  @Patch('products/:productId')
  @RequirePermissions('catalog.manage')
  updateProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Body() input: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(user, productId, input);
  }

  @Delete('products/:productId')
  @RequirePermissions('catalog.manage')
  deactivateProduct(@CurrentUser() user: AuthenticatedUser, @Param('productId') productId: string) {
    return this.catalog.deactivateProduct(user, productId);
  }
}
