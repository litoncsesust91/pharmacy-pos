# Phase 12: SaaS Subscription Management

## Delivered

- Added subscription plans with prices, currency, and JSON-configured limits.
- Added tenant subscriptions with trial, active, suspended, canceled, and billing-period state.
- Added owner subscription endpoints:
  - `GET /api/subscriptions/plans`
  - `GET /api/subscriptions/current`
  - `PATCH /api/subscriptions/current/plan`
  - `POST /api/subscriptions/current/cancel`
- Added a replaceable `BillingProvider` abstraction with a local provider.
- Added idempotent billing webhook handling at `POST /api/subscriptions/webhooks/local`.
- Revalidated subscription entitlement during login and every authenticated request.
- Enforced server-side limits for branches, products, and monthly completed sales.
- Added usage summaries for branches, users, products, and monthly sales.
- Added subscription audit events and owner permissions.

## Seeded Plans

- `starter`: 1 branch, 5 users, 1,000 products, 5,000 monthly sales.
- `growth`: 5 branches, 25 users, 10,000 products, 25,000 monthly sales.
- Demo tenant: 14-day trial on `starter`.

## Verification

```bash
npm run db:generate
npm run db:migrate --workspace @pharmacy-pos/api -- --name subscriptions
npm run db:seed
npm run typecheck
npm run lint
npm test
npm run build
```

The local billing provider is intentionally replaceable. Production billing requires a provider implementation with signed webhook verification.
