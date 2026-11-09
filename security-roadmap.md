# Pharmacy POS Security Roadmap

Security is a required deliverable in every development phase. A phase is not complete until its security controls, tests, audit behavior, and known limitations are documented in that phase's review file.

## Security Status Legend

- **Implemented:** Available in the current codebase.
- **Planned:** Required for the named phase but not implemented yet.
- **Deferred:** Intentionally scheduled for a later phase.

## Phase 01: Local Foundation

### Implemented

- Helmet security headers.
- Global request validation.
- Request property whitelisting.
- Unknown-value rejection.
- Environment-based configuration.
- `.env` exclusion from version control.
- Dependency lockfile.
- TypeScript strict checks.
- ESLint checks.
- Automated unit tests.
- Production build verification.
- Docker isolation for local PostgreSQL and Redis services.

### Security Tests

- API health endpoint smoke test.
- Type checking.
- Linting.
- Backend unit test.
- Frontend unit test.
- Production build test.

### Limitations

- No authentication.
- No RBAC.
- No tenant isolation.
- No audit logging for business actions.
- CORS remains suitable only for local development.
- No real sensitive or pharmacy data may be used.

## Phase 02: Tenants, Authentication, and RBAC

### Implemented In Phase 2

### Security Features

- OIDC/OAuth2 authentication.
- Secure session handling.
- Password recovery through the identity provider.
- MFA for owners and administrators.
- Default-deny permissions.
- Server-side RBAC guards.
- Tenant and branch request context.
- Branch-level access restrictions.
- User invitation and deactivation controls.
- Login and role-change audit logs.
- IDOR protection.
- Tenant-isolation tests.
- Optional PostgreSQL Row-Level Security defense in depth.

### Security Tests

- Unauthenticated request rejection.
- Unauthorized permission rejection.
- Cross-tenant access rejection.
- Cross-branch access rejection.
- Disabled-user rejection.
- Session-expiration test.
- MFA policy test.
- Direct-object-reference manipulation test.

## Phase 03: Country and Business Configuration

### Implemented In Phase 3

### Security Features

- Administrator-only configuration changes.
- Audit logs for tax, VAT, currency, timezone, and policy changes.
- Validation of currency and tax values.
- Versioned tax and pharmacy policy changes.
- Approval workflow for sensitive production settings.
- Protection against executable or dynamic configuration injection.
- Tenant-scoped configuration access.

### Security Tests

- Unauthorized configuration update rejection.
- Invalid tax and currency validation.
- Cross-tenant configuration isolation.
- Configuration audit verification.
- Policy rollback verification.

## Phase 04: Product Catalog

### Security Features

- Role-controlled product and price changes.
- Audit logs for cost, selling price, tax, and prescription flags.
- Tenant-scoped barcode and SKU uniqueness.
- Import file validation.
- Import row and file-size limits.
- CSV formula-injection protection during exports.
- File-type and content validation for product attachments.
- Soft deletion for historical integrity.

### Security Tests

- Unauthorized price-change rejection.
- Duplicate barcode validation.
- Malicious import-file test.
- Oversized import rejection.
- CSV export formula-injection test.
- Historical transaction access after product deactivation.

## Phase 05: Batch Inventory and FEFO

### Security Features

- Database transactions for stock operations.
- Row locking for concurrent stock deduction.
- Negative-stock prevention.
- Immutable stock ledger.
- Permission-controlled stock adjustments.
- Approval workflow for write-offs and corrections.
- Expired, recalled, and quarantined batch blocking.
- Audit record for every stock movement.
- Server-side FEFO enforcement.

### Security Tests

- Concurrent sale test.
- Negative-stock test.
- Expired-batch bypass test.
- Recalled-batch bypass test.
- Unauthorized adjustment test.
- Ledger-tampering test.
- Duplicate stock-movement test.
- Refund stock-restoration test.

## Phase 06: Purchasing and Receiving

### Security Features

- Permission-controlled purchase creation and approval.
- Separation of purchase approval and receiving where required.
- Supplier data access restrictions.
- Batch and expiry validation during receiving.
- Duplicate-receiving protection.
- Audit logs for purchase cost and quantity changes.
- Approval for purchase returns.
- Anomaly checks for unusual quantity or cost changes.

### Security Tests

- Unauthorized receiving rejection.
- Self-approval policy test.
- Duplicate receiving test.
- Invalid batch and expiry test.
- Purchase-return authorization test.
- Supplier data isolation test.

## Phase 07: Offline POS and Sales

### Security Features

- Minimal offline data cache.
- Expiring offline sessions.
- Offline permission snapshot with reconnect revalidation.
- IndexedDB outbox for pending transactions.
- Idempotency keys for offline sales.
- Server-side revalidation during synchronization.
- Stale-stock detection.
- Explicit synchronization conflict handling.
- Offline transaction limits.
- Online-only restriction for high-risk products.
- No local storage of raw payment credentials.
- Audit trail for device, user, client time, server time, and sync status.

### Security Tests

- Offline expired-product test.
- Offline permission-expiration test.
- Duplicate synchronization test.
- Stale-stock conflict test.
- Malformed outbox payload test.
- Offline controlled-product restriction test.
- Device/session expiration test.
- Reconnect replay test.

## Phase 08: Payments and Cash Management

### Security Features

- Payment-provider abstraction.
- Provider tokenization instead of storing card details.
- Signed webhook verification.
- Payment idempotency keys.
- Separate payment and sale states.
- Permission-controlled refunds and voids.
- Approval for unusual refunds and discounts.
- Cash-session audit logs.
- Expected-versus-counted cash reconciliation.
- Provider transaction-reference tracking.
- Secure payment credentials.
- PCI-scope minimization.

### Security Tests

- Forged webhook rejection.
- Duplicate payment test.
- Payment timeout and retry test.
- Failed-payment sale test.
- Unauthorized refund test.
- Refund replay test.
- Cash discrepancy authorization test.
- Raw-card-data storage scan.

## Phase 09: Prescriptions and Controlled Products

### Security Features

- Least-privilege prescription access.
- Private object storage.
- Expiring signed document URLs.
- Encryption for sensitive documents.
- Prescription access audit logs.
- Retention and deletion policies.
- Pharmacist approval workflow.
- Controlled-product restrictions.
- Export restrictions for medical data.
- Offline blocking for high-risk workflows.
- Country-specific regulatory policy adapters.

### Security Tests

- Unauthorized prescription access rejection.
- Expired signed-URL test.
- Prescription download audit test.
- Controlled-product approval test.
- Offline high-risk operation rejection.
- Document type and size validation test.
- Retention and deletion test.

## Phase 10: Notifications and Background Jobs

### Security Features

- Authenticated queue access.
- Validated job payloads.
- Idempotent jobs.
- Retry limits and dead-letter handling.
- Sensitive-data minimization in notifications.
- Protected failed-job logs.
- Notification preference authorization.
- Tenant-scoped scheduled jobs.
- Monitoring for repeated or suspicious failures.

### Security Tests

- Unauthorized queue access test.
- Malformed job payload test.
- Duplicate notification test.
- Retry exhaustion test.
- Sensitive-data log scan.
- Cross-tenant notification test.
- Notification preference authorization test.

## Phase 11: Reports and Exports

### Security Features

- Server-side tenant and branch filtering.
- Role-based report access.
- Financial-report restrictions.
- Protected generated files.
- Expiring export URLs.
- Export audit logs.
- CSV formula-injection prevention.
- Prescription-data export restrictions.
- Export size and rate limits.
- Background processing for large reports.

### Security Tests

- Cross-tenant report test.
- Cross-branch report test.
- Unauthorized financial-report test.
- Expired export-link test.
- CSV injection test.
- Sensitive-data export test.
- Large-export authorization test.

## Phase 12: SaaS Subscriptions

### Security Features

- Signed billing-provider webhooks.
- Server-side subscription enforcement.
- Tenant-scoped billing records.
- Usage-limit enforcement.
- Protected owner-only billing screens.
- Subscription-change audit logs.
- Secure trial, suspension, and cancellation state transitions.
- Session and entitlement revalidation.

### Security Tests

- Forged billing webhook rejection.
- Plan-limit bypass test.
- Suspended-tenant access test.
- Billing-record tenant-isolation test.
- Subscription replay test.
- Old-session entitlement test.

## Phase 13: Responsive UX and Hardware

### Security Features

- Barcode input validation.
- Browser permission minimization.
- Authenticated local hardware bridge.
- HTTPS outside local development.
- Content Security Policy.
- Restricted print and device commands.
- Hardware status validation.
- Protection against malformed scanner input.

### Security Tests

- Malformed barcode input test.
- Scanner payload injection test.
- Unauthorized hardware-command test.
- CSP verification.
- Browser permission review.
- Local bridge authentication test.

## Phase 14: Production Readiness

### Security Features

- Threat modeling.
- OWASP security testing.
- Penetration testing.
- Dependency vulnerability scanning.
- Container image scanning.
- Secret rotation.
- Centralized audit-log storage.
- Security monitoring and alerting.
- Backup encryption.
- Restore testing.
- Incident-response procedures.
- Breach-response procedures.
- Data retention and deletion enforcement.
- Bangladesh compliance review.
- Separate EU/Germany compliance review.

### Security Tests

- Full regression security suite.
- Tenant-isolation penetration tests.
- Authorization matrix tests.
- Disaster-recovery test.
- Secret-rotation test.
- Vulnerability-scan review.
- Incident-response tabletop exercise.
- Backup restoration test.

## Overall Defense-in-Depth Model

```text
Identity
  -> Session security
    -> Tenant and branch context
      -> RBAC and permission checks
        -> Input validation
          -> Domain rules
            -> Database transactions and constraints
              -> Immutable audit records
                -> Monitoring, backups, and incident response
```

No single security control is sufficient by itself.

## Global Security Rules

- Backend authorization is mandatory.
- Frontend hiding is not a security control.
- Permissions default to deny.
- Tenant and branch scope must be enforced at every data-access boundary.
- Financial and stock records are append-only.
- Corrections use reversal records instead of destructive updates.
- Secrets must never be committed or logged.
- Prescription and personal data must be minimized.
- Sensitive actions must be auditable.
- External callbacks must be authenticated.
- Retryable operations must be idempotent.
- Security tests are part of the phase's Definition of Done.

## Security Review Requirement

Every phase review file must include:

- Security features implemented in that phase.
- Security features intentionally deferred.
- Threats introduced by the phase.
- Security test cases.
- QA interview questions and expected answers.
- Remaining risks and follow-up actions.
