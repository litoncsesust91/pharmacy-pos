# Phase 03: Country and Business Configuration Review

## Status

Completed.

## Scope

Phase 3 makes regional and pharmacy business behavior configurable at tenant scope instead of hardcoding Bangladesh assumptions into future inventory, sales, payment, or reporting modules.

## Implemented Features

### Country Profiles

- Country profile model.
- Bangladesh profile (`BD`).
- Germany template profile (`DE`) for future EU expansion.
- Default currency.
- Default timezone.
- Default locale.
- Default tax name and rate.
- Default expiry policy.
- Default prescription policy.
- Default controlled-drug policy.

### Tenant Settings

- One settings record per tenant.
- Country profile association.
- Currency code.
- IANA timezone.
- Locale.
- Tax/VAT enabled flag.
- Tax/VAT name.
- Tax/VAT rate.
- Expiry warning days.
- Expired-product blocking.
- Near-expiry-product blocking.
- Prescription-required policy.
- Controlled-drug policy.
- Offline high-risk-sale policy.
- Receipt prefix.

### Payment Methods

- Tenant-specific payment methods.
- Enabled/disabled state.
- Display name.
- Sort order.
- Unique payment method code per tenant.
- Bangladesh seed methods: cash, card, bKash, Nagad, and Rocket.

### Settings API

```text
GET   /api/settings
GET   /api/settings/country-profiles
PATCH /api/settings
```

### Validation

- Country codes must be two uppercase letters.
- Currency codes must be three uppercase letters.
- Tax rates must be between 0 and 100 with at most two decimal places.
- Expiry warning periods must be between 1 and 3650 days.
- Receipt prefixes have bounded length.
- Payment method codes are restricted to safe lowercase identifiers.
- Duplicate payment method codes are rejected.
- Unsupported country profiles are rejected.

## Bangladesh Defaults

```text
Country: Bangladesh
Country code: BD
Currency: BDT
Timezone: Asia/Dhaka
Locale: en-BD
Tax name: VAT
Tax rate: 0.00 pending regulatory confirmation
Expiry warning: 90 days
Block expired products: true
Block near-expiry products: false
Prescription required: true
Controlled drugs enabled: true
Offline high-risk sales: false
```

The Bangladesh tax rate is intentionally seeded as zero until the applicable business and regulatory rate is confirmed. The setting is configurable and must not be interpreted as a legal tax decision.

## Germany Expansion Template

The Germany profile is included to validate future country extensibility:

```text
Country: Germany
Country code: DE
Currency: EUR
Timezone: Europe/Berlin
Locale: de-DE
Tax name: VAT
Default tax rate: 19.00 template value
```

The Germany profile is not a compliance implementation. German pharmacy, VAT, privacy, prescription, and payment requirements require a separate legal and product review before use.

## Why These Features Were Developed

### Country Profiles

Country profiles provide a controlled source of regional defaults. Adding Germany later should create or update configuration rather than introduce Bangladesh-specific conditionals throughout the codebase.

### Tenant Settings

Tenants may have different operational settings even in the same country. Settings are stored per tenant so branch and organization workflows can use a consistent tenant policy.

### Explicit Overrides

The settings record stores effective values rather than resolving defaults at every read. This makes the active configuration visible, auditable, and stable when a country profile changes later.

### Payment Method Records

Payment methods vary by country and tenant. Separate records allow bKash, Nagad, Rocket, card, cash, and future Germany/EU providers to be enabled without changing sale models.

### Structured Policy Fields

Expiry, prescription, controlled-drug, and offline policies are represented as typed fields instead of unvalidated JSON. These values affect safety-critical behavior and require predictable validation.

### Transactional Settings Update

Settings and payment methods are changed in one database transaction. A failed payment-method update cannot leave the tenant with half-applied configuration.

### Audit Logging

Configuration changes affect tax, sale eligibility, payments, and pharmacy safety. Updates produce tenant-scoped audit events with changed values and the acting user.

## Security Features Implemented

- Settings endpoints require authentication.
- Settings read requires `settings.read`.
- Settings updates require `settings.manage`.
- Tenant ID is taken from the authenticated user, not request input.
- Country profile lookup rejects unsupported country codes.
- Validation rejects malformed currency, country, timezone, tax, and payment values.
- Duplicate payment codes are rejected.
- Settings and payment-method changes are transactional.
- Settings updates are audited.
- No secrets or payment credentials are stored in payment-method configuration.
- Germany is provided as a non-production template, not an assumed compliance profile.

## Test Strategy

### Automated Tests

Run:

```powershell
npm run typecheck --workspace @pharmacy-pos/api -- --incremental false
npm run lint --workspace @pharmacy-pos/api
npm test --workspace @pharmacy-pos/api
npm run build --workspace @pharmacy-pos/api
```

Tests cover:

- Tenant-scoped settings reads.
- Unsupported country rejection.
- Permission guards from Phase 2.
- Tenant and branch boundaries from Phase 2.
- Health endpoint behavior.

### Database Tests

```powershell
npm run db:generate
npm run db:migrate --workspace @pharmacy-pos/api -- --name country_settings
npm run db:seed
```

Verify:

- Bangladesh and Germany country profiles exist.
- Demo tenant settings reference Bangladesh.
- Payment methods are seeded.
- Seed execution is repeatable.
- Tenant settings are unique per tenant.
- Payment method codes are unique per settings record.

### API Tests

1. Request `/api/settings` without a token and expect `401`.
2. Login as the demo owner.
3. Request `/api/settings` and verify BDT, `Asia/Dhaka`, and `BD`.
4. Request `/api/settings/country-profiles` and verify BD and DE are returned.
5. Update expiry warning days and receipt prefix.
6. Replace payment methods and verify order and enabled state.
7. Submit country code `ZZ` and expect `400`.
8. Submit duplicate payment method codes and expect `400`.
9. Use a user without `settings.manage` and expect `403`.
10. Confirm a settings audit record is created.

## Verification Results

Passed:

- Prisma client generation.
- Country-settings migration.
- Repeatable seed execution.
- API type checking.
- API linting.
- API build.
- Four API test suites.
- Eight API tests.
- Bangladesh settings retrieval.
- Country profile retrieval.
- Settings update.
- Payment-method replacement.
- Unsupported-country rejection.
- Settings audit record creation.

## QA Interview

### QA: Why are country profiles separate from tenant settings?

Expected answer: Country profiles provide reusable defaults, while tenant settings store the effective configuration and tenant-specific overrides.

### QA: Why is Bangladesh tax seeded as zero?

Expected answer: The legal and commercial VAT rate has not been confirmed. Zero avoids silently applying an unverified rate while preserving a configurable VAT field.

### QA: Is the Germany profile production-ready?

Expected answer: No. It is an extensibility template only. Germany requires separate pharmacy, VAT, privacy, prescription, payment, and compliance validation.

### QA: Why are payment methods stored separately?

Expected answer: Providers and payment options differ by country and tenant. Separate records permit configuration and future provider adapters without changing sales domain models.

### QA: Why are settings updates transactional?

Expected answer: Settings and payment methods must either both change or neither change. Partial configuration could cause incorrect tax or payment behavior.

### QA: Can a user update another tenant's settings by sending a tenant ID?

Expected answer: No. The API does not accept tenant ID for the operation. It derives tenant scope from the authenticated user.

### QA: Why are policy fields typed instead of stored as arbitrary JSON?

Expected answer: Tax, expiry, prescription, controlled-drug, and offline policies affect safety-critical behavior. Typed fields provide validation, discoverability, and predictable domain logic.

### QA: What prevents an invalid payment method code?

Expected answer: DTO validation restricts codes to bounded lowercase identifiers, and the service rejects duplicate codes within the tenant settings record.

### QA: What should happen when a country profile is removed or unavailable?

Expected answer: The update must fail rather than creating a dangling or unknown country policy. Existing effective settings remain unchanged.

### QA: Why is `offlineHighRiskSalesAllowed` false by default?

Expected answer: Offline operation has stale-data and synchronization risks. High-risk sales should remain online-only until the offline policy is explicitly approved.

### QA: What must be audited?

Expected answer: Country, currency, tax, expiry, prescription, controlled-drug, offline, receipt, and payment-method changes, including the acting user and tenant.

### QA: What security limitation remains?

Expected answer: Settings changes currently require permission and are audited, but there is no second-person approval workflow yet. That should be considered before production for tax and controlled-product policy changes.

## Known Limitations and Risks

- Bangladesh regulatory and VAT values still require confirmation.
- Germany is only a template profile.
- Timezone and locale strings are format-validated but not yet checked against a canonical IANA/CLDR registry.
- No approval workflow exists for sensitive settings.
- Payment providers are configuration records only; gateway integrations are not implemented.
- Tax calculation is not yet connected to sales.
- Settings are tenant-wide; branch-level overrides are not implemented.
- Settings history is stored through audit logs but there is no rollback UI.

## Next Phase

Phase 4 will implement the product catalog:

- Products.
- Generic names.
- Companies and brands.
- Categories and groups.
- Dosage forms and units.
- Strength and pack size.
- Barcodes and SKUs.
- Pricing and tax references.
- Minimum and reorder quantities.
- Supplier associations.
- Product import validation.
