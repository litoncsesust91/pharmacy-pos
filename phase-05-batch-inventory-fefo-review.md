# Phase 05: Batch Inventory and FEFO Review

## Status

Completed.

## Scope

Phase 5 adds branch-scoped batch inventory before purchasing and POS orchestration. Product master records remain quantity-free; current quantity is stored on batches and every change is recorded in an immutable ledger.

## Implemented Features

- Product batches with batch number, manufacturing date, expiry date, purchase cost, selling price, and quantity.
- Branch-scoped inventory queries.
- Receiving movements with idempotency protection.
- FEFO stock allocation for sales.
- Refund, adjustment, damage, and expiry movements.
- Recalled and quarantined batch status controls.
- Expired, recalled, and quarantined batch blocking during allocation.
- Conditional quantity updates and serializable transactions for concurrent deductions.
- Immutable stock ledger entries containing movement type, quantity delta, resulting quantity, actor, reason, and idempotency key.
- Audit events for receiving, allocation, movements, and batch status changes.

## API

```text
GET   /api/inventory/batches
POST  /api/inventory/batches
PATCH /api/inventory/batches/:batchId/status
POST  /api/inventory/allocate
POST  /api/inventory/movements
```

## Security Controls

- Every inventory query includes the authenticated tenant.
- Batch operations require an assigned branch.
- Product and batch references are tenant-scoped.
- Inventory permissions distinguish reading, receiving, selling, and adjusting.
- Database uniqueness protects batch identity and movement idempotency.
- Conditional updates prevent negative stock under concurrent writes.
- FEFO eligibility is enforced by the server.
- Ledger rows are never updated or deleted by application services.
- Every stock-changing operation is audited.

## Verification

```powershell
npm.cmd run db:generate --workspace @pharmacy-pos/api
npm.cmd run typecheck --workspace @pharmacy-pos/api -- --incremental false
npm.cmd run lint --workspace @pharmacy-pos/api
npm.cmd test --workspace @pharmacy-pos/api
npm.cmd run build --workspace @pharmacy-pos/api
```

## Known Limitations

- Purchase orders and supplier receiving workflows remain in Phase 6.
- Full POS sale and refund orchestration remains in Phase 7; this phase exposes inventory primitives.
- Formal stock-count approval and branch transfer workflows remain follow-up work.
- Database-level role restrictions for direct ledger tampering require production database deployment controls.

## Next Phase

Phase 6 will implement purchasing, approvals, partial receiving, purchase returns, and supplier payable tracking on top of these batch and ledger primitives.
