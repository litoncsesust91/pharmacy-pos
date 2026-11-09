-- CreateTable
CREATE TABLE "CountryProfile" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCurrencyCode" TEXT NOT NULL,
    "defaultTimezone" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL,
    "defaultTaxName" TEXT NOT NULL,
    "defaultTaxRate" DECIMAL(5,2) NOT NULL,
    "defaultExpiryWarningDays" INTEGER NOT NULL,
    "defaultBlockExpired" BOOLEAN NOT NULL,
    "defaultBlockNearExpiry" BOOLEAN NOT NULL,
    "defaultPrescriptionRequired" BOOLEAN NOT NULL,
    "defaultControlledDrugs" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "countryProfileId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "taxEnabled" BOOLEAN NOT NULL DEFAULT true,
    "taxName" TEXT NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "expiryWarningDays" INTEGER NOT NULL DEFAULT 90,
    "blockExpiredProducts" BOOLEAN NOT NULL DEFAULT true,
    "blockNearExpiryProducts" BOOLEAN NOT NULL DEFAULT false,
    "prescriptionRequired" BOOLEAN NOT NULL DEFAULT true,
    "controlledDrugsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "offlineHighRiskSalesAllowed" BOOLEAN NOT NULL DEFAULT false,
    "receiptPrefix" TEXT NOT NULL DEFAULT 'SALE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantPaymentMethod" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TenantPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CountryProfile_code_key" ON "CountryProfile"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_tenantId_key" ON "TenantSettings"("tenantId");

-- CreateIndex
CREATE INDEX "TenantSettings_countryProfileId_idx" ON "TenantSettings"("countryProfileId");

-- CreateIndex
CREATE INDEX "TenantPaymentMethod_settingsId_enabled_idx" ON "TenantPaymentMethod"("settingsId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "TenantPaymentMethod_settingsId_code_key" ON "TenantPaymentMethod"("settingsId", "code");

-- AddForeignKey
ALTER TABLE "TenantSettings" ADD CONSTRAINT "TenantSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSettings" ADD CONSTRAINT "TenantSettings_countryProfileId_fkey" FOREIGN KEY ("countryProfileId") REFERENCES "CountryProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPaymentMethod" ADD CONSTRAINT "TenantPaymentMethod_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "TenantSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
