import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.systemInfo.upsert({
    where: { key: 'schema-version' },
    update: { value: 'phase-11' },
    create: { key: 'schema-version', value: 'phase-11' },
  });

  const bangladesh = await prisma.countryProfile.upsert({
    where: { code: 'BD' },
    update: { name: 'Bangladesh' },
    create: {
      code: 'BD',
      name: 'Bangladesh',
      defaultCurrencyCode: 'BDT',
      defaultTimezone: 'Asia/Dhaka',
      defaultLocale: 'en-BD',
      defaultTaxName: 'VAT',
      defaultTaxRate: 0,
      defaultExpiryWarningDays: 90,
      defaultBlockExpired: true,
      defaultBlockNearExpiry: false,
      defaultPrescriptionRequired: true,
      defaultControlledDrugs: true,
    },
  });

  await prisma.countryProfile.upsert({
    where: { code: 'DE' },
    update: { name: 'Germany' },
    create: {
      code: 'DE',
      name: 'Germany',
      defaultCurrencyCode: 'EUR',
      defaultTimezone: 'Europe/Berlin',
      defaultLocale: 'de-DE',
      defaultTaxName: 'VAT',
      defaultTaxRate: 19,
      defaultExpiryWarningDays: 90,
      defaultBlockExpired: true,
      defaultBlockNearExpiry: false,
      defaultPrescriptionRequired: true,
      defaultControlledDrugs: true,
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-pharmacy' },
    update: { name: 'Demo Pharmacy', isActive: true },
    create: { name: 'Demo Pharmacy', slug: 'demo-pharmacy' },
  });

  const branch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'MAIN' } },
    update: { name: 'Main Branch', isActive: true },
    create: { tenantId: tenant.id, name: 'Main Branch', code: 'MAIN' },
  });

  const settings = await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: { countryProfileId: bangladesh.id },
    create: {
      tenantId: tenant.id,
      countryProfileId: bangladesh.id,
      currencyCode: 'BDT',
      timezone: 'Asia/Dhaka',
      locale: 'en-BD',
      taxEnabled: true,
      taxName: 'VAT',
      taxRate: 0,
      expiryWarningDays: 90,
      blockExpiredProducts: true,
      blockNearExpiryProducts: false,
      prescriptionRequired: true,
      controlledDrugsEnabled: true,
      offlineHighRiskSalesAllowed: false,
      receiptPrefix: 'SALE',
    },
  });

  const paymentMethods = [
    ['cash', 'Cash', 0],
    ['card', 'Card', 1],
    ['bkash', 'bKash', 2],
    ['nagad', 'Nagad', 3],
    ['rocket', 'Rocket', 4],
  ] as const;
  await prisma.tenantPaymentMethod.deleteMany({ where: { settingsId: settings.id } });
  await prisma.tenantPaymentMethod.createMany({
    data: paymentMethods.map(([code, displayName, sortOrder]) => ({
      settingsId: settings.id,
      code,
      displayName,
      sortOrder,
      enabled: true,
    })),
  });

  const company = await prisma.company.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Demo Pharma Ltd.' } },
    update: { isActive: true },
    create: { tenantId: tenant.id, name: 'Demo Pharma Ltd.' },
  });
  const group = await prisma.productGroup.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Analgesic' } },
    update: { isActive: true },
    create: { tenantId: tenant.id, name: 'Analgesic' },
  });
  const supplier = await prisma.supplier.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Demo Medical Supply' } },
    update: { isActive: true },
    create: { tenantId: tenant.id, name: 'Demo Medical Supply' },
  });
  const product = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'PARA-500-TAB' } },
    update: {
      companyId: company.id,
      groupId: group.id,
      name: 'Paracetamol 500 mg Tablet',
      genericName: 'Paracetamol',
      dosageForm: 'Tablet',
      strength: '500 mg',
      packSize: 10,
      unit: 'tablet',
      taxCategory: 'standard',
      purchasePrice: 1.5,
      sellingPrice: 2,
      minimumStock: 20,
      reorderQuantity: 100,
      prescriptionRequired: false,
      controlledDrug: false,
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      companyId: company.id,
      groupId: group.id,
      name: 'Paracetamol 500 mg Tablet',
      genericName: 'Paracetamol',
      dosageForm: 'Tablet',
      strength: '500 mg',
      packSize: 10,
      unit: 'tablet',
      sku: 'PARA-500-TAB',
      taxCategory: 'standard',
      purchasePrice: 1.5,
      sellingPrice: 2,
      minimumStock: 20,
      reorderQuantity: 100,
    },
  });
  await prisma.productBarcode.deleteMany({ where: { productId: product.id } });
  await prisma.productBarcode.create({
    data: { tenantId: tenant.id, productId: product.id, code: '8901234567890', isPrimary: true },
  });
  await prisma.productSupplier.upsert({
    where: { productId_supplierId: { productId: product.id, supplierId: supplier.id } },
    update: { preferred: true },
    create: { productId: product.id, supplierId: supplier.id, preferred: true },
  });

  const permissionDefinitions = [
    ['tenant.read', 'View the current tenant'],
    ['branch.read', 'View assigned branches'],
    ['branch.manage', 'Create and manage branches'],
    ['user.read', 'View users'],
    ['user.manage', 'Manage users'],
    ['settings.read', 'View tenant settings'],
    ['settings.manage', 'Manage tenant settings'],
    ['catalog.read', 'View catalog records'],
    ['catalog.manage', 'Manage catalog records'],
    ['inventory.read', 'View inventory and batches'],
    ['inventory.receive', 'Receive stock into batches'],
    ['inventory.sell', 'Allocate stock for sales'],
    ['inventory.adjust', 'Adjust and quarantine stock'],
    ['purchasing.read', 'View purchasing records and payables'],
    ['purchasing.manage', 'Manage supplier terms'],
    ['purchasing.create', 'Create and submit purchase orders'],
    ['purchasing.approve', 'Approve purchase orders and returns'],
    ['purchasing.receive', 'Receive approved purchase orders'],
    ['purchasing.return', 'Create and complete purchase returns'],
    ['purchasing.pay', 'Record supplier payments'],
    ['sales.read', 'View sales and receipts'],
    ['sales.create', 'Create and complete sales'],
    ['sales.manage', 'Manage customers'],
    ['payments.read', 'View payment and cash records'],
    ['payments.create', 'Create and confirm payments'],
    ['payments.refund', 'Request and complete refunds'],
    ['payments.approve', 'Approve refunds and cash discrepancies'],
    ['cash.open', 'Open cash sessions'],
    ['cash.manage', 'Manage registers and cash movements'],
    ['cash.close', 'Close cash sessions'],
    ['cash.approve', 'Approve cash discrepancies'],
    ['prescription.read', 'View prescription records'],
    ['prescription.create', 'Create prescription records'],
    ['prescription.approve', 'Approve prescriptions as pharmacist'],
    ['prescription.document', 'Access protected prescription documents'],
    ['notifications.read', 'Read in-app notifications'],
    ['notifications.manage', 'Manage notification preferences'],
    ['jobs.read', 'View background jobs and schedules'],
    ['jobs.manage', 'Queue and retry background jobs'],
    ['reports.read', 'Run tenant-scoped reports'],
    ['reports.export', 'Export reports as CSV or PDF'],
  ] as const;

  const permissions = await Promise.all(
    permissionDefinitions.map(([key, description]) =>
      prisma.permission.upsert({
        where: { key },
        update: { description },
        create: { key, description },
      }),
    ),
  );

  const ownerRole = await prisma.role.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'owner' } },
    update: { name: 'Owner' },
    create: { tenantId: tenant.id, name: 'Owner', key: 'owner' },
  });

  await Promise.all(
    permissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: ownerRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: ownerRole.id, permissionId: permission.id },
      }),
    ),
  );

  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'owner@demo.local' } },
    update: { isActive: true },
    create: {
      tenantId: tenant.id,
      email: 'owner@demo.local',
      passwordHash: await argon2.hash('ChangeMe123!'),
      firstName: 'Demo',
      lastName: 'Owner',
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: owner.id, roleId: ownerRole.id } },
    update: {},
    create: { userId: owner.id, roleId: ownerRole.id },
  });

  await prisma.userBranch.upsert({
    where: { userId_branchId: { userId: owner.id, branchId: branch.id } },
    update: {},
    create: { userId: owner.id, branchId: branch.id },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
