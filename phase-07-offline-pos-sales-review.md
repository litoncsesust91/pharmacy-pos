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

## Testing Procedure

### API Automated Checks

Run these from the repository root:

```powershell
npm.cmd run db:generate --workspace @pharmacy-pos/api
npm.cmd run db:migrate --workspace @pharmacy-pos/api
npm.cmd run db:seed --workspace @pharmacy-pos/api
npm.cmd run typecheck --workspace @pharmacy-pos/api -- --incremental false
npm.cmd run lint --workspace @pharmacy-pos/api
npm.cmd test --workspace @pharmacy-pos/api
npm.cmd run build --workspace @pharmacy-pos/api
```

Expected results:

- Prisma generation and migrations complete without errors.
- Seed execution is repeatable and sets the schema version to `phase-7`.
- API typecheck, lint, and build pass.
- All API suites pass, including branch isolation, offline high-risk product blocking, and sale idempotency tests.

### API Manual Verification

1. Login as the seeded owner and save the access token.
2. Request `GET /api/catalog/products` and confirm the catalog is available.
3. Create or identify a valid branch and product batch with future expiry.
4. Submit `POST /api/sales` with one product and quantity `1`; expect a completed sale and receipt number.
5. Submit the same payload and idempotency key again; expect the original sale without another stock deduction.
6. Submit a sale for more stock than is available; expect `400` and no sale record.
7. Add two eligible batches with different expiry dates and confirm the earlier expiry batch is allocated first.
8. Mark a batch recalled or quarantined and confirm checkout cannot allocate it.
9. Submit a suspended sale; confirm it does not reduce batch quantity.
10. Resume the suspended sale and confirm FEFO allocation and stock deduction occur once.
11. Submit an `OFFLINE` sale for a controlled or prescription product; expect rejection unless tenant policy explicitly allows it.
12. Use a branch outside the authenticated user assignment; expect `403` or `404` and no data disclosure.
13. Verify sale, resume, and customer actions appear in the tenant audit log.

### Web Automated Checks

Run these from the repository root:

```powershell
npm.cmd run typecheck --workspace @pharmacy-pos/web
npm.cmd run lint --workspace @pharmacy-pos/web
npm.cmd test --workspace @pharmacy-pos/web
npm.cmd run build --workspace @pharmacy-pos/web
```

Expected results:

- TypeScript compilation succeeds.
- ESLint reports no errors.
- Vitest completes successfully.
- Vite produces a production bundle.

### Web Manual Verification

1. Start the API and web app with `npm.cmd run dev`.
2. Open the web app on a desktop viewport and confirm the POS catalog, cart, totals, connection status, and outbox status are visible.
3. Enter an API token through the connection form with the seeded credentials and valid branch ID; confirm the server catalog replaces demo data.
4. Search by product name or SKU and press `Enter`; confirm the first result is added to the cart.
5. Increase and decrease quantities, clear the cart by reducing quantity to zero, and verify totals update.
6. Complete an online sale and confirm the notice reports successful synchronization.
7. Suspend a sale and confirm the cart clears and the outbox count increases.
8. Disable the network in browser developer tools, add a product, and complete a sale; confirm it is queued rather than lost.
9. Reload the page while offline; confirm the cached catalog and queued count remain available through IndexedDB.
10. Restore the network, reconnect with a valid session, select `Sync now`, and confirm the queued sale is removed after a successful response.
11. Repeat synchronization with the same queued item and confirm the server idempotency key prevents duplication.
12. Expire or remove the browser session token and confirm synchronization is disabled until the cashier reconnects.
13. Check a mobile viewport and confirm catalog, cart, checkout, and connection controls remain usable without horizontal scrolling.

### Security and Failure Tests

- Attempt to synchronize a malformed outbox payload and confirm the server rejects it without changing stock.
- Let the access token expire while offline and confirm the UI does not synchronize until re-authentication.
- Create a stale-stock conflict by selling the final unit from another client, then synchronize the queued sale and confirm it remains queued with a visible retry state.
- Scan an expired product batch and confirm the server rejects it even if the browser catalog cache is stale.
- Confirm IndexedDB contains catalog and sale intent data only, with no raw card number, CVV, or provider credential fields.

## Known Limitations

- The browser requires a valid branch ID and authenticated session before syncing real sales.
- Offline policy currently uses tenant high-risk configuration and does not yet enforce device-level quotas.
- Stale-stock conflicts remain queued for explicit retry; there is no cashier conflict-resolution screen yet.
- Payment confirmation, cash sessions, refunds, and provider integrations belong to Phase 8.
- Receipt rendering is represented by sale/receipt records; printer and hardware adapters belong to Phase 13.

## Next Phase

Phase 8 will separate payment state from sale state and implement cash registers, cashier sessions, local payment adapters, refunds, and reconciliation.
