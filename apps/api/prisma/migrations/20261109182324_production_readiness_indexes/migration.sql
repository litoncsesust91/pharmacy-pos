-- CreateIndex
CREATE INDEX "PaymentTransaction_tenantId_createdAt_status_idx" ON "PaymentTransaction"("tenantId", "createdAt", "status");

-- CreateIndex
CREATE INDEX "Sale_tenantId_cashierId_createdAt_idx" ON "Sale"("tenantId", "cashierId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_tenantId_paymentMethod_createdAt_idx" ON "Sale"("tenantId", "paymentMethod", "createdAt");
