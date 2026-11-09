# Phase 07: Offline POS and Sales Review

## Status

Completed.

## Scope

Phase 7 adds the cashier-facing POS and the server-authoritative sales workflow. The browser caches only catalog data and sale intents; inventory allocation, price/tax validation, high-risk policy, and idempotency remain server-side.

## Implemented Features

- Desktop-first responsive POS layout with mobile fallback.
- Barcode/SKU/name search input with Enter-to-add behavior.
- Keyboard-oriented checkout controls and quantity controls.
- Cart management with subtotal, discount, tax-ready totals, and receipts.
- Customer search/create API and optional customer reference in sales.
- Sale snapshots for product name, SKU, unit price, discount, tax, and total.
- Suspended sales and resume workflow.
- Server-side FEFO allocation during completed sales.
- Expired, recalled, quarantined, and insufficient stock blocking.
- Offline browser catalog cache using IndexedDB.
- Offline sale outbox using IndexedDB.
- Replay-safe sale synchronization through server idempotency keys.
- Retry tracking and explicit queued/synchronized status in the POS UI.
- Online-only restriction for prescription and controlled products by default.
- No raw payment credentials stored; payment methods are only non-sensitive labels until Phase 8.
- Audit events for customer creation, completed sales, suspended sales, and resumed sales.

## API

```text
GET  /api/sales/customers
POST /api/sales/customers
GET  /api/sales
GET  /api/sales/:saleId
POST /api/sales
POST /api/sales/:saleId/resume
```

## Security Controls

- Tenant and branch scope is enforced on every sale and customer query.
- Sale idempotency keys prevent duplicate synchronization effects.
- FEFO is selected and enforced on the server.
- Stock deduction and sale creation share one serializable transaction.
- Offline high-risk products are rejected unless explicitly enabled by tenant policy.
- Client prices are never trusted; prices and tax rates come from server catalog/settings.
- Suspended sales do not reserve or deduct stock.
- The browser stores only catalog snapshots and sale intents, not payment credentials.
- Client timestamps are informational; server timestamps remain authoritative.

## Verification

```powershell
npm.cmd run db:generate --workspace @pharmacy-pos/api
npm.cmd run typecheck --workspace @pharmacy-pos/api -- --incremental false
npm.cmd run lint --workspace @pharmacy-pos/api
npm.cmd test --workspace @pharmacy-pos/api
npm.cmd run typecheck --workspace @pharmacy-pos/web
npm.cmd run lint --workspace @pharmacy-pos/web
npm.cmd test --workspace @pharmacy-pos/web
npm.cmd run build
```

## Known Limitations

- The browser requires a valid branch ID and authenticated session before syncing real sales.
- Offline policy currently uses tenant high-risk configuration and does not yet enforce device-level quotas.
- Stale-stock conflicts remain queued for explicit retry; there is no cashier conflict-resolution screen yet.
- Payment confirmation, cash sessions, refunds, and provider integrations belong to Phase 8.
- Receipt rendering is represented by sale/receipt records; printer and hardware adapters belong to Phase 13.

## Next Phase

Phase 8 will separate payment state from sale state and implement cash registers, cashier sessions, local payment adapters, refunds, and reconciliation.
