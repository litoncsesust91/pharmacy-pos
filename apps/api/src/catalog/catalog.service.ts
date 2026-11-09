import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateNamedCatalogDto,
  CreateProductDto,
  CreateSupplierDto,
  ProductImportDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/catalog.dto.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';

const productInclude = {
  company: true,
  group: true,
  barcodes: { orderBy: { isPrimary: 'desc' as const } },
  suppliers: { include: { supplier: true } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly subscriptions?: SubscriptionsService,
  ) {}

  listCompanies(user: AuthenticatedUser) {
    return this.prisma.company.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createCompany(user: AuthenticatedUser, input: CreateNamedCatalogDto) {
    const name = input.name.trim();
    try {
      const company = await this.prisma.company.create({
        data: { tenantId: user.tenantId, name },
      });
      await this.recordChange(user, 'company.created', 'Company', company.id, { name });
      return company;
    } catch (error) {
      this.throwConflict(error, 'Company name already exists');
    }
  }

  listGroups(user: AuthenticatedUser) {
    return this.prisma.productGroup.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createGroup(user: AuthenticatedUser, input: CreateNamedCatalogDto) {
    const name = input.name.trim();
    try {
      const group = await this.prisma.productGroup.create({
        data: { tenantId: user.tenantId, name },
      });
      await this.recordChange(user, 'product-group.created', 'ProductGroup', group.id, { name });
      return group;
    } catch (error) {
      this.throwConflict(error, 'Product group name already exists');
    }
  }

  listSuppliers(user: AuthenticatedUser) {
    return this.prisma.supplier.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createSupplier(user: AuthenticatedUser, input: CreateSupplierDto) {
    try {
      const supplier = await this.prisma.supplier.create({
        data: {
          tenantId: user.tenantId,
          name: input.name.trim(),
          phone: input.phone?.trim(),
          email: input.email?.trim().toLowerCase(),
        },
      });
      await this.recordChange(user, 'supplier.created', 'Supplier', supplier.id, {
        name: supplier.name,
      });
      return supplier;
    } catch (error) {
      this.throwConflict(error, 'Supplier name already exists');
    }
  }

  async listProducts(user: AuthenticatedUser, query: ProductQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where: Prisma.ProductWhereInput = {
      tenantId: user.tenantId,
      isActive: query.active ?? true,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.supplierId ? { suppliers: { some: { supplierId: query.supplierId } } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { genericName: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
              { barcodes: { some: { code: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const sortBy = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder ?? 'asc';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async validateProductImport(user: AuthenticatedUser, input: ProductImportDto) {
    const skus = input.rows.map((row) => row.sku.trim());
    const barcodes = input.rows.flatMap((row) => this.uniqueValues(row.barcodes));
    const duplicateSkus = this.duplicates(skus);
    const duplicateBarcodes = this.duplicates(barcodes);
    const [existingSkuRows, existingBarcodeRows] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: { tenantId: user.tenantId, sku: { in: skus } },
        select: { sku: true },
      }),
      this.prisma.productBarcode.findMany({
        where: { tenantId: user.tenantId, code: { in: barcodes } },
        select: { code: true },
      }),
    ]);
    const existingSkus = existingSkuRows.map(({ sku }) => sku);
    const existingBarcodes = existingBarcodeRows.map(({ code }) => code);
    const errors = [
      ...duplicateSkus.map((value) => `Duplicate SKU in import: ${value}`),
      ...duplicateBarcodes.map((value) => `Duplicate barcode in import: ${value}`),
      ...existingSkus.map((value) => `SKU already exists: ${value}`),
      ...existingBarcodes.map((value) => `Barcode already exists: ${value}`),
    ];
    return {
      valid: errors.length === 0,
      rowCount: input.rows.length,
      errors,
    };
  }

  async getProduct(user: AuthenticatedUser, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId: user.tenantId },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async createProduct(user: AuthenticatedUser, input: CreateProductDto) {
    await this.subscriptions?.assertWithinLimit(user, 'products');
    await this.assertReferences(user, input.companyId, input.groupId, input.supplierIds);
    this.assertNoDuplicates(input.barcodes, 'Barcode values must be unique');
    this.assertNoDuplicates(input.supplierIds, 'Supplier values must be unique');
    const barcodes = this.uniqueValues(input.barcodes);
    try {
      const product = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.product.create({
          data: {
            tenantId: user.tenantId,
            companyId: input.companyId,
            groupId: input.groupId,
            name: input.name.trim(),
            genericName: input.genericName?.trim(),
            dosageForm: input.dosageForm?.trim(),
            strength: input.strength?.trim(),
            packSize: input.packSize,
            unit: input.unit?.trim(),
            sku: input.sku.trim(),
            taxCategory: input.taxCategory?.trim(),
            purchasePrice: input.purchasePrice,
            sellingPrice: input.sellingPrice,
            minimumStock: input.minimumStock ?? 0,
            reorderQuantity: input.reorderQuantity ?? 0,
            prescriptionRequired: input.prescriptionRequired ?? false,
            controlledDrug: input.controlledDrug ?? false,
            barcodes: {
              create: barcodes.map((code, index) => ({
                tenantId: user.tenantId,
                code,
                isPrimary: index === 0,
              })),
            },
            suppliers: {
              create: this.uniqueValues(input.supplierIds).map((supplierId) => ({ supplierId })),
            },
          },
          include: productInclude,
        });
        return created;
      });
      await this.recordChange(user, 'product.created', 'Product', product.id, {
        sku: product.sku,
        name: product.name,
      });
      return product;
    } catch (error) {
      this.throwConflict(error, 'Product SKU or barcode already exists');
    }
  }

  async updateProduct(user: AuthenticatedUser, productId: string, input: UpdateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException('Product not found');
    await this.assertReferences(user, input.companyId, input.groupId, input.supplierIds);
    this.assertNoDuplicates(input.barcodes, 'Barcode values must be unique');
    this.assertNoDuplicates(input.supplierIds, 'Supplier values must be unique');
    const barcodes = input.barcodes ? this.uniqueValues(input.barcodes) : undefined;
    const priceChanged = input.purchasePrice !== undefined || input.sellingPrice !== undefined;

    try {
      const product = await this.prisma.$transaction(async (transaction) => {
        const updated = await transaction.product.update({
          where: { id: productId },
          data: {
            ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
            ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.genericName !== undefined ? { genericName: input.genericName.trim() } : {}),
            ...(input.dosageForm !== undefined ? { dosageForm: input.dosageForm.trim() } : {}),
            ...(input.strength !== undefined ? { strength: input.strength.trim() } : {}),
            ...(input.packSize !== undefined ? { packSize: input.packSize } : {}),
            ...(input.unit !== undefined ? { unit: input.unit.trim() } : {}),
            ...(input.sku !== undefined ? { sku: input.sku.trim() } : {}),
            ...(input.taxCategory !== undefined ? { taxCategory: input.taxCategory.trim() } : {}),
            ...(input.purchasePrice !== undefined ? { purchasePrice: input.purchasePrice } : {}),
            ...(input.sellingPrice !== undefined ? { sellingPrice: input.sellingPrice } : {}),
            ...(input.minimumStock !== undefined ? { minimumStock: input.minimumStock } : {}),
            ...(input.reorderQuantity !== undefined
              ? { reorderQuantity: input.reorderQuantity }
              : {}),
            ...(input.prescriptionRequired !== undefined
              ? { prescriptionRequired: input.prescriptionRequired }
              : {}),
            ...(input.controlledDrug !== undefined ? { controlledDrug: input.controlledDrug } : {}),
            ...(barcodes
              ? {
                  barcodes: {
                    deleteMany: {},
                    create: barcodes.map((code, index) => ({
                      tenantId: user.tenantId,
                      code,
                      isPrimary: index === 0,
                    })),
                  },
                }
              : {}),
            ...(input.supplierIds
              ? {
                  suppliers: {
                    deleteMany: {},
                    create: this.uniqueValues(input.supplierIds).map((supplierId) => ({ supplierId })),
                  },
                }
              : {}),
          },
          include: productInclude,
        });
        return updated;
      });
      await this.recordChange(user, 'product.updated', 'Product', product.id, {
        fields: Object.keys(input),
        priceChanged,
      });
      return product;
    } catch (error) {
      this.throwConflict(error, 'Product SKU or barcode already exists');
    }
  }

  async deactivateProduct(user: AuthenticatedUser, productId: string) {
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, tenantId: user.tenantId, isActive: true },
    });
    if (!existing) throw new NotFoundException('Product not found');
    const product = await this.prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });
    await this.recordChange(user, 'product.deactivated', 'Product', product.id, {
      sku: product.sku,
    });
    return product;
  }

  private async assertReferences(
    user: AuthenticatedUser,
    companyId?: string,
    groupId?: string,
    supplierIds?: string[],
  ): Promise<void> {
    if (companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: companyId, tenantId: user.tenantId, isActive: true },
      });
      if (!company) throw new NotFoundException('Company not found');
    }
    if (groupId) {
      const group = await this.prisma.productGroup.findFirst({
        where: { id: groupId, tenantId: user.tenantId, isActive: true },
      });
      if (!group) throw new NotFoundException('Product group not found');
    }
    if (supplierIds?.length) {
      const uniqueSupplierIds = this.uniqueValues(supplierIds);
      const count = await this.prisma.supplier.count({
        where: { id: { in: uniqueSupplierIds }, tenantId: user.tenantId, isActive: true },
      });
      if (count !== uniqueSupplierIds.length) throw new NotFoundException('Supplier not found');
    }
  }

  private uniqueValues(values: string[] | undefined): string[] {
    return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
  }

  private duplicates(values: string[]): string[] {
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
  }

  private assertNoDuplicates(values: string[] | undefined, message: string): void {
    if (values && this.uniqueValues(values).length !== values.length) {
      throw new BadRequestException(message);
    }
  }

  private async recordChange(
    user: AuthenticatedUser,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action,
      entityType,
      entityId,
      metadata,
    });
  }

  private throwConflict(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }
    throw error;
  }
}
