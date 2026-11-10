# PostgreSQL Data Verification

This guide explains how to verify the Pharmacy POS PostgreSQL database locally without changing business data.

## 1. Confirm PostgreSQL Is Running

From the repository root:

```powershell
docker compose ps postgres
docker compose exec postgres pg_isready -U pos -d pharmacy_pos
```

Expected status:

```text
accepting connections
```

## 2. Connect With `psql`

Open a PostgreSQL shell inside the container:

```powershell
docker compose exec postgres psql -U pos -d pharmacy_pos
```

The local connection values are:

```text
Host:     localhost
Port:     5432
Database: pharmacy_pos
User:     pos
Password: pos
```

## 3. Inspect Database Structure

Inside `psql`:

```sql
\conninfo
\dt
\d "Tenant"
\d "Product"
\d "Sale"
```

Useful commands:

```sql
\dn              -- list schemas
\dt              -- list tables
\di              -- list indexes
\d+ "Product"    -- table details and indexes
\q               -- exit psql
```

## 4. Verify Seeded Tenant Data

```sql
SELECT id, name, slug, "isActive"
FROM "Tenant";

SELECT id, email, "tenantId", "isActive"
FROM "User";

SELECT id, name, code, "tenantId", "isActive"
FROM "Branch";
```

The default local seed should include:

```text
Tenant slug: demo-pharmacy
User:        owner@demo.local
Password:    ChangeMe123!
Branch:      MAIN
```

## 5. Verify Subscription Data

```sql
SELECT id, key, name, "monthlyPrice", limits, "isActive"
FROM "SubscriptionPlan"
ORDER BY "monthlyPrice";

SELECT "tenantId", "planId", status, "trialEndsAt", "currentPeriodStart", "currentPeriodEnd"
FROM "TenantSubscription";

SELECT "tenantId", metric, "periodStart", quantity
FROM "SubscriptionUsage"
ORDER BY "periodStart" DESC, metric;
```

## 6. Verify Catalog Data

```sql
SELECT COUNT(*) AS products FROM "Product";
SELECT COUNT(*) AS companies FROM "Company";
SELECT COUNT(*) AS groups FROM "ProductGroup";
SELECT COUNT(*) AS suppliers FROM "Supplier";
SELECT COUNT(*) AS barcodes FROM "ProductBarcode";

SELECT p.sku, p.name, p."purchasePrice", p."sellingPrice", c.name AS company, g.name AS product_group
FROM "Product" p
LEFT JOIN "Company" c ON c.id = p."companyId"
LEFT JOIN "ProductGroup" g ON g.id = p."groupId"
WHERE p."isActive" = true
ORDER BY p.name;
```

## 7. Verify Inventory And Ledger Consistency

```sql
SELECT COUNT(*) AS batches FROM "InventoryBatch";
SELECT COUNT(*) AS ledger_entries FROM "StockLedgerEntry";

SELECT b."batchNumber", p.sku, b.quantity, b."expiryDate", b.status, b.recalled, b.quarantined
FROM "InventoryBatch" b
JOIN "Product" p ON p.id = b."productId"
ORDER BY b."expiryDate";
```

To inspect ledger movements for one batch:

```sql
SELECT "movementType", "quantityDelta", "resultingQuantity", "idempotencyKey", "createdAt"
FROM "StockLedgerEntry"
WHERE "batchId" = 'BATCH_ID'
ORDER BY "createdAt";
```

## 8. Verify Sales And Payments

```sql
SELECT COUNT(*) AS sales FROM "Sale";
SELECT status, COUNT(*)
FROM "Sale"
GROUP BY status
ORDER BY status;

SELECT id, "saleNumber", status, total, "paymentStatus", "createdAt"
FROM "Sale"
ORDER BY "createdAt" DESC
LIMIT 20;

SELECT "saleId", method, amount, status, "idempotencyKey", "createdAt"
FROM "PaymentTransaction"
ORDER BY "createdAt" DESC
LIMIT 20;
```

Check for duplicate idempotency keys:

```sql
SELECT "tenantId", "idempotencyKey", COUNT(*)
FROM "Sale"
GROUP BY "tenantId", "idempotencyKey"
HAVING COUNT(*) > 1;
```

This query should return zero rows.

## 9. Verify Tenant Isolation

Every tenant-owned table should contain a tenant boundary. Inspect a specific tenant:

```sql
SELECT COUNT(*) FROM "Product" WHERE "tenantId" = 'TENANT_ID';
SELECT COUNT(*) FROM "Sale" WHERE "tenantId" = 'TENANT_ID';
SELECT COUNT(*) FROM "AuditLog" WHERE "tenantId" = 'TENANT_ID';
```

When testing the API, log in as one tenant and confirm that IDs belonging to another tenant return `404` or `403`, never the other tenant's data.

## 10. Verify Audit Records

```sql
SELECT "action", "entityType", "entityId", "actorId", "createdAt"
FROM "AuditLog"
ORDER BY "createdAt" DESC
LIMIT 50;
```

Sensitive events that should be auditable include:

- Login.
- Product and branch changes.
- Sales and payments.
- Refunds.
- Prescription access.
- Subscription changes.
- Report exports.

## 11. Verify Prisma Migrations

From the repository root:

```powershell
npm.cmd run db:migrate --workspace @pharmacy-pos/api -- status
```

The database should report that all migrations have been applied.

You can also inspect the migration table:

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY finished_at;
```

There should be no unexpected value in `rolled_back_at`.

## 12. Use Prisma Studio

Prisma Studio provides a visual database browser:

```powershell
npm.cmd exec prisma studio --workspace @pharmacy-pos/api
```

Open the URL printed by Prisma, normally:

```text
http://localhost:5555
```

Use Studio for inspection and controlled local development only. Avoid editing financial, inventory, audit, or subscription records directly because those changes bypass service rules and audit events.

## 13. One-Command Read-Only Summary

```powershell
docker compose exec postgres psql -U pos -d pharmacy_pos -c "SELECT (SELECT COUNT(*) FROM \"Tenant\") AS tenants, (SELECT COUNT(*) FROM \"User\") AS users, (SELECT COUNT(*) FROM \"Product\") AS products, (SELECT COUNT(*) FROM \"InventoryBatch\") AS batches, (SELECT COUNT(*) FROM \"Sale\") AS sales, (SELECT COUNT(*) FROM \"PaymentTransaction\") AS payments, (SELECT COUNT(*) FROM \"AuditLog\") AS audit_logs;"
```

## Safety Rules

- Prefer `SELECT` queries for verification.
- Never run `DELETE`, `UPDATE`, or `TRUNCATE` against a shared or production database during inspection.
- Never commit database dumps, passwords, or production connection strings.
- Verify tenant scope in every query involving customer, prescription, financial, or inventory data.
- Use a separate restore database when testing backups.
