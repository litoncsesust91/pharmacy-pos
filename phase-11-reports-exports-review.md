# Phase 11: Reports and Exports

## Delivered

- Added tenant- and branch-scoped reporting at `GET /api/reports`.
- Added shared date, branch, company, group, product, batch, supplier, cashier, and payment filters.
- Added sales, cash, profit, inventory valuation, low-stock, expiry, refund, void, and tax report types.
- Added paginated JSON results with aggregate summaries.
- Added CSV and PDF export links at `GET /api/reports/export`, with tenant-scoped tokens that expire after 24 hours and download through `GET /api/reports/exports/:token`.
- Exports over 5,000 rows are queued through the existing background-job system instead of being returned in the request.
- Added `reports.read` and `reports.export` permissions and seeded them for the owner role.

## Security

- Every query is constrained by the authenticated tenant and assigned branch IDs.
- Explicit branch filters outside the user scope are rejected.
- Supplier, company, group, product, and batch filters are applied within tenant-owned relations.

## Verification

```bash
npm run db:generate
npm run db:migrate --workspace @pharmacy-pos/api -- --name reports_and_exports
npm run db:seed
npm run typecheck
npm test
npm run build
```

Large export processing currently records the background job and notification through the Phase 10 worker. A follow-up can move `ReportExport.content` to object storage when the storage profile is enabled.
