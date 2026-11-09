# Phase 08: Payments and Cash Management Review

## Status

Completed.

## Feature Review

Phase 8 separates payment state from sale state and adds cash-control workflows around the Phase 7 POS:

- Cash register creation and branch assignment.
- Cash session opening with an opening float.
- Cash-in and cash-out movements.
- Local cash, card, bKash, Nagad, and Rocket payment adapters.
- Confirmed and failed payment states.
- Signed payment webhook processing.
- Payment idempotency and provider references.
- Refund request, approval, and completion workflows.
- Cash session closing with expected-versus-counted reconciliation.
- Discrepancy approval with separation of duties.
- Payment and cash audit events.

## Why These Features Were Implemented

Sales and payments have different lifecycles. A sale can exist before payment confirmation, while a payment can fail, be retried, or be refunded later. Keeping payment state in a separate transaction model prevents a failed payment from being mistaken for a completed financial settlement.

Cash sessions establish accountability for physical money. Opening floats, cash-in, cash-out, cash sales, refunds, and closing counts must be tied to a cashier and register so discrepancies can be investigated.

Local adapters are implemented first because they exercise the payment state machine without external provider calls. Provider-specific network integration can be added later without changing sale or cash accounting records.

Refund approval protects against unauthorized reversals and requires a second user for approval. Idempotency keys protect retries from creating duplicate payments, cash movements, refunds, or webhook effects.

## Logic Behind the Implementation

1. A completed sale starts with `paymentStatus = UNPAID`.
2. A payment request validates the tenant, branch, enabled method, sale total, and optional open cash session.
3. The local adapter confirms the payment inside a transaction and changes the sale to `PAID`.
4. Cash payments create a `SALE_CASH` movement in the active session.
5. Cash closing calculates: opening float + cash-in - cash-out + cash sales - cash refunds.
6. A zero discrepancy closes immediately; a non-zero discrepancy enters `PENDING_APPROVAL`.
7. The cashier who closes a session cannot approve that discrepancy.
8. Refunds begin as `PENDING_APPROVAL`, become `APPROVED`, and only then change payment/sale state and cash totals.
9. Webhooks require an HMAC-SHA256 signature and a unique provider event ID.
10. Every retry is guarded by a tenant-scoped idempotency key.

## API

```text
GET  /api/cash/registers
POST /api/cash/registers
GET  /api/cash/sessions/current
POST /api/cash/sessions
POST /api/cash/sessions/:sessionId/movements
POST /api/cash/sessions/:sessionId/close
POST /api/cash/sessions/:sessionId/approve
POST /api/payments
POST /api/payments/webhook
POST /api/refunds
POST /api/refunds/:refundId/review
POST /api/refunds/:refundId/complete
```

## Security Risks Handled

- Duplicate payment replay: tenant-scoped payment idempotency keys.
- Duplicate cash movement replay: tenant-scoped movement idempotency keys.
- Duplicate refund replay: tenant-scoped refund idempotency keys and status transitions.
- Forged provider callbacks: HMAC-SHA256 webhook verification.
- Raw card-data exposure: only payment method and provider reference are stored; card numbers and CVVs are rejected by the contract.
- Cross-tenant payment access: every payment, sale, refund, session, and register query is tenant-scoped.
- Cross-branch cash access: sessions and registers require assigned branch access.
- Self-approved discrepancy: the closing cashier cannot approve the same discrepancy.
- Self-approved refund: the refund requester cannot approve the same refund.
- Payment overcharge: payment amount must equal the unpaid sale total.
- Cash overstatement: cash totals are derived from immutable movement records.
- Unauthorized refunds: refund creation, approval, and completion use separate permissions.

## Interview QA

### Why is payment state separate from sale state?

Because a sale may be created before payment confirmation, and payments can fail, retry, or be refunded independently.

### Why must cash payments use an open cash session?

Without an open session, the payment cannot be attributed to a register, cashier, opening float, or closing reconciliation.

### Can a cashier approve their own discrepancy?

No. The service rejects approval when the approver is the user who closed the session.

### Are card numbers stored?

No. The system stores only a method, local provider name, non-sensitive provider reference, status, and amount.

### What happens when a webhook is replayed?

The provider/event ID uniqueness constraint rejects the duplicate event before it changes payment state.

### Can a payment exceed the sale total?

No. The payment amount must equal the unpaid sale total in the current implementation.

### How is a cash discrepancy handled?

The session records expected cash, counted cash, and discrepancy. A non-zero discrepancy enters pending approval and requires another authorized user.

### What happens if a payment request is retried?

The idempotency key returns the original payment instead of creating another transaction or cash movement.

### Why are local adapters used?

They validate the complete payment lifecycle deterministically without network dependencies or provider credentials. External adapters can replace them later.

### What remains for later phases?

Provider-specific integrations, payment settlement reports, hardware terminals, and advanced refund approval thresholds remain future work.

## Testing Procedure

### Testing Credentials

Use the seeded local account:

```text
Email:       owner@demo.local
Password:    ChangeMe123!
Tenant slug: demo-pharmacy
Branch:      use user.branchIds[0] returned by login
```

The seeded owner has the Phase 8 permissions. Do not use these credentials outside local development.

Set the webhook secret for manual webhook tests:

```text
PAYMENT_WEBHOOK_SECRET=local-payment-webhook-secret
```

### Automated API Checks

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

- Phase 8 migration applies successfully.
- Seed is repeatable and reports schema version `phase-8`.
- All API tests pass, including forged webhook, duplicate payment, self-approval, and branch-isolation checks.

### API Manual Procedure

1. Login with the testing credentials and save `accessToken` and `user.branchIds[0]`.
2. Create a cash register for the assigned branch with `POST /api/cash/registers`.
3. Open a session with `POST /api/cash/sessions` and an opening float of `1000`.
4. Create a completed unpaid sale through `POST /api/sales`.
5. Confirm the sale has `paymentStatus = UNPAID`.
6. Pay the sale through `POST /api/payments` using `cash`, the sale total, and a unique idempotency key.
7. Repeat the same payment request and confirm only one payment and one `SALE_CASH` movement exist.
8. Perform a cash-in and cash-out movement with unique idempotency keys.
9. Close the session with the exact expected cash and confirm status `CLOSED`.
10. Open a second session, close it with an incorrect counted amount, and confirm `PENDING_APPROVAL`.
11. Attempt self-approval and expect `403`.
12. Approve the discrepancy with another authorized user and expect `APPROVED`.
13. Create a refund and confirm it requires approval before completion.
14. Attempt requester self-approval and expect `403`.
15. Approve and complete the refund; confirm sale/payment status and cash refund movement update.
16. Send a webhook with an invalid signature and expect `401`.
17. Send a correctly signed webhook twice and confirm the second request is rejected as a duplicate event.
18. Attempt payment, refund, and session access using another tenant or branch and confirm access is denied.

### Web/API Integration Checks

```powershell
npm.cmd run typecheck --workspace @pharmacy-pos/web
npm.cmd run lint --workspace @pharmacy-pos/web
npm.cmd test --workspace @pharmacy-pos/web
npm.cmd run build
```

1. Open the POS and connect with email, password, tenant slug `demo-pharmacy`, and no manually entered branch ID.
2. Confirm the assigned branch ID is populated automatically from the login response.
3. Complete a sale and confirm the POS invokes sale creation followed by payment confirmation.
4. Disconnect the network, queue a sale, reconnect, and confirm synchronization does not create duplicate payment records.
5. Confirm the browser contains no raw card number, CVV, or provider credential in session storage or IndexedDB.

## Known Limitations

- Payment adapters are local and do not contact real providers.
- Payment amount must equal the full unpaid sale total; split tenders are deferred.
- Approval thresholds for unusually large refunds and discounts are deferred.
- Cash register hardware and receipt printers are deferred to Phase 13.
- Provider settlement and reconciliation reports are future work.

## Next Phase

Phase 9 will implement customer profiles, prescriptions, private prescription documents, pharmacist approval, and controlled-product workflows.
