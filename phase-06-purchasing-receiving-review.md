# Phase 06: Purchasing and Receiving Review

## Status

Completed.

## Scope

Phase 6 adds supplier terms, controlled purchase orders, partial receiving, purchase returns, and supplier payable tracking on top of the Phase 5 batch and immutable stock ledger.

## Implemented Features

- Supplier payment terms and credit-limit fields.
- Purchase orders with tenant, branch, supplier, product lines, cost, tax, and totals.
- Draft, pending approval, approved, rejected, partially received, and received order states.
- Requester and approver identity separation.
- Partial receiving against outstanding order quantities.
- Batch creation during receiving with manufacturing and expiry validation.
- Existing-batch quantity increments when the batch identity matches.
- Receipt idempotency and duplicate receipt protection.
- Purchase returns with approval and completion workflows.
- Stock deduction and immutable ledger entries for completed returns.
- Supplier payable creation for receipts and return credits.
- Supplier payment records with idempotency and balance protection.
- Audit records for order creation, submission, approval, rejection, receiving, returns, and payments.

## API

```text
GET   /api/purchasing/suppliers/:supplierId/terms
PATCH /api/purchasing/suppliers/:supplierId/terms
GET   /api/purchasing/orders
POST  /api/purchasing/orders
POST  /api/purchasing/orders/:orderId/submit
POST  /api/purchasing/orders/:orderId/review
POST  /api/purchasing/orders/:orderId/receive
GET   /api/purchasing/returns
POST  /api/purchasing/returns
POST  /api/purchasing/returns/:returnId/review
POST  /api/purchasing/returns/:returnId/complete
GET   /api/purchasing/payables
POST  /api/purchasing/payables/:payableId/pay
```

## Security Controls

- Supplier, order, receipt, return, and payable queries are tenant-scoped.
- Branch operations require an authenticated branch assignment.
- Purchase requesters cannot approve their own orders or returns.
- Only approved orders can be received.
- Receipt quantities cannot exceed outstanding order quantities.
- Receipt costs must match the approved order cost.
- Expired and invalid manufacturing dates are rejected server-side.
- Receipt and payment idempotency keys prevent duplicate financial or stock effects.
- Returns require approval before stock is deducted.
- Stock deductions use conditional updates inside serializable transactions.
- Every financial and stock-changing operation is audited.

## Verification

```powershell
npm.cmd run db:generate --workspace @pharmacy-pos/api
npm.cmd run typecheck --workspace @pharmacy-pos/api -- --incremental false
npm.cmd run lint --workspace @pharmacy-pos/api
npm.cmd test --workspace @pharmacy-pos/api
npm.cmd run build --workspace @pharmacy-pos/api
```

## Known Limitations

- Purchase approval does not yet enforce configurable monetary approval thresholds.
- Supplier credit limits are stored but are not yet used for automatic blocking.
- Purchase return completion records a supplier credit; credit-note settlement rules are deferred.
- Purchase order cancellation and edit-after-draft endpoints are deferred.
- Anomaly detection for unusual cost or quantity changes remains a future background rule.

## Next Phase

Phase 7 will implement offline POS sales and connect checkout orchestration to FEFO allocation, purchase history, taxes, discounts, receipts, and synchronization.
