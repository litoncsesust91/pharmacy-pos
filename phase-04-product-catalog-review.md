# Phase 04: Product Catalog Review

## Status

Completed.

## Scope

Phase 4 establishes tenant-scoped pharmacy master data before batch inventory and POS sales are implemented.

## Implemented Features

### Catalog Entities

- Companies or brands.
- Product groups or categories.
- Suppliers.
- Products.
- Primary and alternate barcodes.
- Product-supplier associations.

### Product Fields

- Product name.
- Generic name.
- Dosage form.
- Strength.
- Pack size.
- Unit.
- Tenant-scoped SKU.
- Tax category reference.
- Purchase price.
- Selling price.
- Minimum stock quantity.
- Reorder quantity.
- Prescription-required flag.
- Controlled-drug flag.
- Active/inactive state.

### Catalog API

```text
GET    /api/catalog/companies
POST   /api/catalog/companies
GET    /api/catalog/groups
POST   /api/catalog/groups
GET    /api/catalog/suppliers
POST   /api/catalog/suppliers
GET    /api/catalog/products
POST   /api/catalog/products
GET    /api/catalog/products/:productId
PATCH  /api/catalog/products/:productId
DELETE /api/catalog/products/:productId
POST   /api/catalog/products/import/validate
```

### Product Search and Filtering

Product listing supports:

- Search by product name.
- Search by generic name.
- Search by SKU.
- Search by barcode.
- Company filter.
- Product-group filter.
- Supplier filter.
- Active/inactive filter.
- Pagination.
- Page size limit.
- Sorting by name, SKU, creation date, or selling price.
- Ascending and descending ordering.

### Import Validation

The import validation endpoint accepts normalized product rows and checks:

- Duplicate SKUs within the import.
- Duplicate barcodes within the import.
- Existing tenant SKUs.
- Existing tenant barcodes.
- Maximum import size of 500 rows.

Actual CSV and Excel parsing will be added with the file-import adapter in a later iteration. The validation service is already separated from persistence so file adapters can use it.

## Why These Features Were Developed

### Tenant-Scoped Master Data

SaaS tenants must not share product names, SKUs, barcodes, companies, groups, or suppliers. Every catalog query and uniqueness rule includes tenant scope.

### Separate Barcode Records

A medicine may have alternate barcodes or packaging identifiers. A separate barcode model supports multiple identifiers without duplicating product records.

### Separate Companies, Groups, and Suppliers

Filtering and reporting require stable relationships rather than free-text values repeated on every product. This also supports future product analytics by company and group.

### Decimal Prices

Purchase and selling prices use database decimal values instead of floating-point values to avoid money-rounding errors.

### Minimum and Reorder Quantities

These fields prepare the catalog for Phase 5 stock alerts and purchasing suggestions without placing inventory quantities on the product master record.

### Soft Deactivation

Products are deactivated rather than deleted. Historical sales, stock, and audit records will need product identity after POS and inventory are implemented.

### Tenant-Scoped Uniqueness

The same SKU or barcode may exist in different organizations, but not twice within the same tenant. Database constraints enforce this even if application checks are bypassed.

### Import Preview Before Persistence

Import validation prevents duplicate and conflicting rows from reaching the database. It gives the UI a safe preview step before a future import-commit workflow is added.

## Security Features Implemented

- Catalog endpoints require authentication.
- Catalog reads require `catalog.read`.
- Catalog changes require `catalog.manage`.
- Tenant scope comes from the authenticated user.
- Company, group, and supplier references are verified inside the current tenant.
- Cross-tenant product references return not found.
- SKU uniqueness is enforced per tenant.
- Barcode uniqueness is enforced per tenant.
- Duplicate import values are rejected.
- Product changes are audited.
- Price changes are identified in audit metadata.
- Products use soft deactivation.
- Product import rows have a maximum size.
- Product input fields have bounded lengths and validated formats.

## Test Strategy

### Automated Checks

```powershell
npm run typecheck --workspace @pharmacy-pos/api -- --incremental false
npm run lint --workspace @pharmacy-pos/api
npm test --workspace @pharmacy-pos/api
npm run build --workspace @pharmacy-pos/api
```

### Automated Test Coverage

- Tenant-scoped company reads.
- Cross-tenant company-reference rejection.
- Duplicate barcode rejection.
- Duplicate import SKU detection.
- Authentication and permission guards.
- Tenant and branch isolation from previous phases.
- Settings and health behavior from previous phases.

### API Verification

1. Login as the seeded owner.
2. Create a company, group, and supplier.
3. Create a product with pricing, SKU, barcode, and supplier link.
4. Retrieve the product by ID.
5. Search by name, generic name, SKU, and barcode.
6. Filter by company, group, and supplier.
7. Sort by selling price and name.
8. Deactivate the product and verify it is absent from active results.
9. Submit an import with duplicate SKU values and expect `valid: false`.
10. Submit an existing SKU or barcode and expect a validation error.
11. Attempt to use another tenant's company or supplier ID and expect `404`.
12. Confirm product creation, update, price changes, and deactivation are audited.

## Verification Results

Passed:

- Prisma client generation.
- Product catalog migration.
- Seed execution.
- API type checking.
- API linting.
- API build.
- Five API test suites.
- Twelve API tests.
- Company, group, and supplier creation.
- Product creation with barcode and supplier.
- Product search.
- Import duplicate-SKU validation.
- Duplicate SKU/barcode protection.

## QA Interview

### QA: Why are SKU and barcode uniqueness tenant-scoped?

Expected answer: Different organizations may use the same SKU or barcode conventions. Duplicate identity is only invalid within the same tenant.

### QA: Why are barcode records separate from products?

Expected answer: One product can have multiple valid barcodes for packaging or supplier labeling. Separate records support this without duplicating product data.

### QA: Can a product reference a company from another tenant?

Expected answer: No. The service verifies the company using both its ID and the authenticated tenant ID.

### QA: Why are products deactivated instead of deleted?

Expected answer: Future sales, inventory, and audit records need stable historical product references.

### QA: Why are prices stored as Decimal?

Expected answer: Floating-point values can produce financial rounding errors. Decimal storage preserves monetary accuracy.

### QA: What happens when two users create the same SKU concurrently?

Expected answer: The database composite unique constraint rejects the second write. The service converts the constraint error into a conflict response.

### QA: Why does import validation run before import persistence?

Expected answer: It lets staff correct duplicates and conflicts before any catalog rows are changed. It also makes CSV/Excel parsing independent of business validation.

### QA: Why is import limited to 500 rows?

Expected answer: It prevents oversized synchronous requests and resource exhaustion. Larger imports should use an authenticated background job later.

### QA: Which product fields affect pharmacy safety?

Expected answer: Prescription-required, controlled-drug, dosage form, strength, and eventually batch/expiry policy. These fields require authorization and audit behavior.

### QA: Does the product catalog track current stock?

Expected answer: No. Product master data stores thresholds only. Actual quantity belongs to the batch-aware inventory ledger in Phase 5.

### QA: What should happen when a price changes?

Expected answer: The update requires catalog-management permission and creates an audit event. Future sales should preserve the applied sale price independently of later catalog changes.

### QA: What is not implemented yet?

Expected answer: CSV/Excel file parsing, product import commit workflow, batch stock, inventory quantities, and POS price snapshots are future work.

## Known Limitations and Risks

- CSV and Excel upload parsing is not implemented yet.
- Import validation does not persist validated rows.
- Product tax category is a reference string until country tax rules become more detailed.
- Product prices are not yet versioned or stored on sales.
- Product-level policy flags will need interaction rules with tenant settings.
- Supplier payment terms are not implemented.
- No branch-specific catalog or pricing override exists yet.
- No product-image or document upload exists yet.

## Next Phase

Phase 5 will implement batch-aware inventory and FEFO:

- Product batches.
- Manufacturing and expiry dates.
- Stock ledger.
- Receiving movements.
- FEFO allocation.
- Expired and recalled batch blocking.
- Stock adjustment and count workflows.
- Branch stock transfers.
- Concurrency-safe stock deduction.
