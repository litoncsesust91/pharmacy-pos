# Pharmacy POS SaaS Roadmap

## 1. Roadmap Purpose

This roadmap defines the implementation sequence for a pharmacy POS SaaS platform starting in Bangladesh, with the architecture prepared for later expansion to the European Union and Germany.

The system must support pharmacy-specific operations, including batch and expiry tracking, FEFO stock allocation, fast barcode checkout, offline POS operation, RBAC, cash management, notifications, and configurable country-specific rules.

The first deployment target is a local development environment. Production hosting will be selected later.

## 2. Product Direction

### Initial Market

- Target country: Bangladesh.
- Initial product language and operational assumptions should support Bangladesh.
- Bangladesh-specific rules must be configuration-driven wherever possible.
- Regulatory requirements must be confirmed with qualified local pharmacy, tax, and legal experts before production use.

### Future Markets

- European Union.
- Germany as the first planned European market.
- Additional countries should be added through country configuration and provider adapters rather than changes to core inventory, sales, or accounting logic.

### Initial Business Target

The first pilot should support a single pharmacy branch while keeping the data model and authorization model ready for multiple branches.

Multi-branch capabilities should be implemented in the foundation, but advanced branch operations can be delivered after the single-branch pilot is stable.

## 3. Configuration-First Strategy

The following capabilities must be configurable and must not be hardcoded into core business workflows:

- Country and regional settings.
- Pharmacy regulations.
- Prescription rules.
- Controlled-drug rules.
- Tax and VAT rules.
- Currency.
- Timezone.
- Date, time, and number formats.
- Invoice and receipt formats.
- Payment providers.
- Payment-method availability.
- Product categories and dosage forms.
- Minimum stock and reorder rules.
- Expiry warning periods.
- Near-expiry sale policy.
- Refund and return policy.
- Branch settings.
- Notification channels.
- User roles and permissions.
- Subscription plans and limits.
- Data-retention periods.
- Offline synchronization policies.

Country-specific behavior should be represented through configuration, policy services, and provider interfaces. Core domain logic should not contain scattered country checks.

## 4. Regional and Regulatory Roadmap

## 4.1 Bangladesh Initial Configuration

The initial country profile should support:

- Bangladesh as the tenant country.
- Bangladeshi Taka (BDT).
- Bangladesh business timezone, configurable per tenant.
- Bangladesh date and number formatting.
- Bangladesh receipt and invoice requirements.
- Configurable Bangladesh tax and VAT behavior.
- Bangladesh pharmacy product, prescription, and controlled-product policies.
- Local payment providers through adapters.

The exact tax, VAT, pharmacy, prescription, controlled-product, and record-retention rules must be validated before production deployment. The system must not assume that a generic retail configuration is legally sufficient.

## 4.2 Future EU and Germany Configuration

The architecture should later support:

- Germany and other EU country profiles.
- Euro (EUR).
- German timezone and locale formats.
- German VAT rules.
- EU privacy and data-retention requirements.
- Germany-specific pharmacy and prescription workflows.
- Germany and EU payment providers.
- Country-specific receipt and invoice formats.

EU/Germany expansion should be treated as a separate compliance and product phase, not only a translation exercise.

## 5. Payment Provider Roadmap

Create a payment-provider abstraction so checkout does not depend directly on one provider.

### Initial Bangladesh Payment Methods

- Cash.
- Card.
- bKash.
- Nagad.
- Rocket.
- Bank transfer where required.
- Mixed payments where supported by business policy.

### Future Payment Methods

- Germany and EU card processing.
- SEPA-related payment options where appropriate.
- Local German payment providers.
- Additional country-specific wallets and gateways.

Each provider integration should define:

- Payment creation.
- Payment confirmation.
- Payment failure.
- Refund.
- Reconciliation.
- Webhook handling.
- Idempotency.
- Provider transaction reference.
- Currency support.

The application must distinguish payment status from sale status. A failed or pending payment must not incorrectly finalize a sale.

## 6. Hardware Roadmap

### Initial Hardware Strategy

Use a browser-based POS first.

- USB barcode scanners should work as keyboard input.
- Standard receipt printers should work through browser print support.
- Product search should work without a scanner.
- Keyboard shortcuts should support rapid checkout.
- Hardware capabilities should be hidden behind application interfaces.

### Future Hardware Support

- Cash drawer integration.
- Label printer integration.
- Vendor-specific receipt printer integration.
- Tauri desktop bridge for local hardware access.
- Hardware health and connection status.

Do not introduce a desktop wrapper until browser capabilities are insufficient or offline/hardware requirements justify it.

## 7. Offline-First POS Roadmap

Offline mode is required.

## 7.1 Offline Goals

The POS should continue to support essential checkout operations during temporary network loss.

Offline operation must not silently create duplicate sales, corrupt stock, or lose payment information.

## 7.2 Offline Architecture

- Use a Progressive Web App for the POS.
- Store an approved offline data set in IndexedDB.
- Maintain a local transaction outbox.
- Assign temporary client transaction IDs.
- Synchronize transactions when connectivity returns.
- Make synchronization idempotent.
- Show online, offline, syncing, and failed-sync states clearly.
- Retry failed synchronization safely.
- Keep an audit record of synchronization events.

## 7.3 Offline Data

The offline cache may include:

- Active products.
- Barcodes.
- Prices.
- Tax configuration.
- Eligible stock and batch information.
- Product availability.
- Branch settings.
- Authenticated user permissions required for POS.
- Customer lookup data according to privacy policy.

Prescription documents and sensitive data should not be cached offline unless explicitly approved by security and regulatory review.

## 7.4 Offline Business Rules

- The offline cache must have an expiration period.
- The system must define whether offline sales can use cached stock quantities.
- Offline sales should have configurable transaction limits.
- High-risk operations may require an online connection.
- Controlled products and selected prescription workflows may be blocked offline.
- The system must warn staff when cached inventory may be stale.
- Synchronization conflicts must be visible and resolved through an explicit workflow.
- A sale must never be finalized twice because of retry or reconnection.

## 7.5 Synchronization Strategy

- Use an outbox pattern on the client.
- Use an idempotency key for every offline-created transaction.
- Process synchronization in dependency order.
- Confirm server acceptance before removing an outbox item.
- Preserve failed records for investigation.
- Provide manager tools for unresolved stock or payment conflicts.
- Record the original device, user, client timestamp, server timestamp, and sync status.

## 8. Local Development Environment

The initial environment should run locally using Docker Compose.

### Local Services

- React/Vite frontend.
- NestJS API.
- Background worker.
- PostgreSQL.
- Redis.
- MinIO or another S3-compatible local object store.
- Local email capture service.
- Optional Keycloak instance for local OIDC authentication.

### Local Development Requirements

- One command to start required services.
- Environment variable template.
- Database migrations.
- Seed data.
- Demo tenant and branch.
- Demo users for each role.
- Demo products and batches.
- Local payment-provider adapters.
- Local notification adapters.
- Offline-mode testing instructions.
- Test data reset command.

No production cloud dependency should be required for normal local development.

## 9. Authentication and Identity Roadmap

Authentication must use an abstraction that supports local and hosted providers.

### Initial Approach

- Use an OIDC-compatible provider.
- Run Keycloak locally if a self-hosted identity provider is selected.
- Support secure login, logout, password recovery, and session expiry.
- Add MFA support for owners and administrators.
- Include tenant, branch, user, and role context in authenticated requests.
- Enforce permissions on the backend.

### Future Approach

- Replace or supplement local identity with a managed OIDC provider.
- Support enterprise SSO where required.
- Support stronger organization-level authentication policies.

Frontend route protection must never be the only authorization control.

## 10. Delivery Phases

## Phase 0: Discovery and Decisions

### Tasks

- Confirm Bangladesh pharmacy regulations.
- Confirm Bangladesh tax and VAT rules.
- Confirm invoice and receipt requirements.
- Confirm prescription and controlled-drug requirements.
- Confirm data-retention and privacy requirements.
- Confirm initial payment providers.
- Confirm target receipt printer and barcode scanner.
- Confirm offline sales policy.
- Select authentication provider.
- Define initial single-branch pilot scope.
- Define future multi-branch behavior.
- Define Bangladesh country profile.
- Define EU/Germany expansion constraints.

### Exit Criteria

- Regulatory assumptions are documented.
- Country settings are identified.
- Payment and hardware priorities are known.
- Offline rules are approved.
- Pilot scope is fixed.

## Phase 1: Local Technical Foundation

### Tasks

- Initialize React/Vite frontend.
- Initialize NestJS backend.
- Configure TypeScript, ESLint, Prettier, and tests.
- Configure Docker Compose.
- Add PostgreSQL and Redis.
- Add MinIO for local document storage.
- Add migrations and seed data.
- Add environment configuration.
- Add CI checks.
- Add API error and logging standards.
- Add OpenAPI documentation.

### Exit Criteria

- The complete stack runs locally.
- Database migrations and seed data work.
- Frontend and backend communicate successfully.
- CI passes linting, type checks, and tests.

## Phase 2: Tenants, Branches, Authentication, and RBAC

### Tasks

- Implement tenants.
- Implement branches.
- Implement users and invitations.
- Implement roles and permissions.
- Implement branch assignments.
- Add tenant and branch request context.
- Add backend authorization guards.
- Add audit-log foundation.
- Add tenant-isolation tests.

### Exit Criteria

- A user can log in and access an authorized tenant.
- Users can be assigned to branches.
- Permissions are enforced server-side.
- Cross-tenant and unauthorized access tests pass.

## Phase 3: Country and Business Configuration

### Tasks

- Create country profile model.
- Create currency configuration.
- Create timezone configuration.
- Create locale and number-format configuration.
- Create tax/VAT configuration.
- Create receipt configuration.
- Create pharmacy policy configuration.
- Create prescription and controlled-drug policy configuration.
- Create expiry and stock policy configuration.
- Create payment-method configuration.
- Create notification configuration.

### Exit Criteria

- Bangladesh can be selected as the initial country profile.
- Currency and timezone are tenant-configurable.
- Tax/VAT behavior is configuration-driven.
- New country profiles can be added without changing core transaction models.

## Phase 4: Product Catalog and Master Data

### Tasks

- Implement products.
- Implement generic names, companies, and groups.
- Implement dosage forms, units, strength, and pack size.
- Implement barcodes and SKUs.
- Implement pricing, tax, minimum stock, and reorder quantities.
- Implement suppliers.
- Implement customers.
- Implement import from CSV/Excel.
- Implement search, filtering, sorting, and pagination.

### Exit Criteria

- Staff can manage pharmacy products.
- Products can be found by barcode, name, generic name, company, and group.
- Product data is tenant- and branch-aware.
- Product changes are audited.

## Phase 5: Batch Inventory and FEFO

### Tasks

- Implement product batches.
- Implement expiry dates and manufacturing dates.
- Implement purchase cost and batch pricing.
- Implement immutable stock ledger.
- Implement receiving movements.
- Implement sale movements.
- Implement refund movements.
- Implement adjustment, damage, expiry, and quarantine movements.
- Implement FEFO allocation.
- Block expired and recalled batches.
- Implement stock counts and reconciliation.
- Implement branch stock transfers.
- Add concurrency protection.

### Exit Criteria

- Stock is tracked by product, branch, and batch.
- FEFO selects the earliest valid expiry batch.
- Expired stock cannot be sold.
- Every stock change has an immutable ledger entry.
- Concurrent sales cannot corrupt available quantity.

## Phase 6: Purchasing and Receiving

### Tasks

- Implement suppliers and supplier terms.
- Implement purchase orders.
- Implement purchase approvals.
- Implement partial receiving.
- Create batches during receiving.
- Capture cost, tax, expiry, and supplier information.
- Implement purchase returns.
- Implement supplier payable tracking.

### Exit Criteria

- Inventory staff can receive products into correct batches.
- Partial receiving works.
- Receiving updates inventory correctly.
- Purchase returns produce correct stock and financial records.

## Phase 7: Offline POS and Sales

### Tasks

- Implement desktop POS layout.
- Implement barcode input.
- Implement keyboard shortcuts.
- Implement fast product search.
- Implement cart management.
- Implement batch and expiry warnings.
- Implement FEFO checkout allocation.
- Implement customer selection.
- Implement discounts and taxes.
- Implement suspended sales.
- Implement receipt generation.
- Implement IndexedDB offline cache.
- Implement offline transaction outbox.
- Implement synchronization and retry handling.
- Implement idempotency and conflict handling.

### Exit Criteria

- Cashier can complete online and offline sales.
- Expired and blocked products cannot be sold.
- Offline transactions synchronize without duplication.
- Staff can see offline and synchronization status.
- Offline policy limits are enforced.

## Phase 8: Payments and Cash Management

### Tasks

- Implement cash register opening.
- Implement cashier sessions.
- Implement cash-in and cash-out.
- Implement cash, card, bKash, Nagad, Rocket, and configurable methods.
- Implement payment-provider adapters.
- Implement payment confirmation and failure handling.
- Implement provider webhooks.
- Implement refunds.
- Implement cash closing.
- Implement expected versus counted cash.
- Implement discrepancy approval.

### Exit Criteria

- Payment status and sale status are consistent.
- Duplicate payments are prevented.
- Cash sessions reconcile correctly.
- Refunds create auditable reversal records.
- Local payment adapters work without external provider calls.

## Phase 9: Customers, Prescriptions, and Controlled Products

### Tasks

- Implement customer profiles.
- Implement prescription references.
- Implement private prescription document storage.
- Implement prescription-required product rules.
- Implement pharmacist approval.
- Implement controlled-product policy configuration.
- Implement restricted prescription access.
- Implement prescription audit records.
- Define online-only behavior for high-risk operations.

### Exit Criteria

- Prescription rules are configurable.
- Required products follow the configured approval workflow.
- Prescription documents are protected.
- Access is audited.
- Offline restrictions are enforced for high-risk products.

## Phase 10: Notifications and Background Processing

### Tasks

- Configure Redis and BullMQ.
- Implement worker service.
- Implement low-stock jobs.
- Implement near-expiry jobs.
- Implement expired-stock jobs.
- Implement daily sales summaries.
- Implement scheduled reports.
- Implement in-app notifications.
- Add email and push adapters.
- Add retries, idempotency, and failed-job monitoring.

### Exit Criteria

- Notifications run asynchronously.
- Checkout is not blocked by jobs.
- Failed jobs can be retried.
- Duplicate notifications are avoided.
- Users can configure notification preferences.

## Phase 11: Reports and Exports

### Tasks

- Implement shared report filtering.
- Implement date-range filters.
- Implement company, group, product, batch, branch, supplier, cashier, and payment filters.
- Implement daily, monthly, and yearly sales reports.
- Implement cash reports.
- Implement profit and margin reports.
- Implement inventory valuation.
- Implement low-stock and expiry reports.
- Implement refund and void reports.
- Implement tax/VAT reports.
- Implement CSV and PDF export.
- Move large reports to background jobs.

### Exit Criteria

- Reports respect tenant, branch, and role restrictions.
- Financial reports reconcile with transaction records.
- Reports can be filtered, sorted, paginated, and exported.
- Large reports do not block the application.

## Phase 12: SaaS Subscription Management

### Tasks

- Implement subscription plans.
- Implement trials.
- Implement plan limits.
- Implement usage tracking.
- Implement activation, suspension, and cancellation.
- Add billing-provider abstraction.
- Add subscription notifications.
- Add owner subscription screens.

### Exit Criteria

- Plan limits are enforced server-side.
- Subscription status is visible to tenant owners.
- Suspended tenants are restricted safely.
- Billing integration can be replaced without changing sales or inventory logic.

## Phase 13: Responsive UX and Hardware Validation

### Tasks

- Optimize POS for desktop.
- Optimize inventory and receiving for tablets.
- Optimize reports and manager workflows for mobile.
- Validate keyboard navigation.
- Validate touch controls.
- Test barcode scanners.
- Test receipt printers.
- Test cash drawer integrations if required.
- Test label printers if required.
- Add PWA installation support.

### Exit Criteria

- POS works on target desktop hardware.
- Inventory works on tablets.
- Reports and manager actions work on mobile.
- Barcode and receipt workflows are validated with real devices.

## Phase 14: Security, Performance, and Production Readiness

### Tasks

- Add database indexes.
- Run load tests.
- Test concurrent checkout.
- Test offline synchronization at scale.
- Test tenant isolation.
- Test all sensitive permissions.
- Add rate limiting.
- Add secure headers.
- Configure backups.
- Perform restore testing.
- Add monitoring and alerting.
- Add error tracking.
- Add data export and retention controls.
- Create deployment and rollback procedures.
- Prepare support and training documentation.

### Exit Criteria

- Critical security tests pass.
- Backup restoration has been verified.
- Performance targets are met.
- Errors and failed jobs are observable.
- Deployment is repeatable.
- Pilot support documentation is complete.

## 11. Recommended Release Milestones

### Milestone 1: Local Foundation

- Local Docker environment.
- Authentication.
- Tenants.
- Branches.
- Users.
- RBAC.
- Audit foundation.

### Milestone 2: Pharmacy Master Data

- Bangladesh country profile.
- Configurable currency and timezone.
- Configurable tax/VAT rules.
- Products.
- Companies.
- Groups.
- Suppliers.
- Customers.
- Barcodes.

### Milestone 3: Inventory Core

- Batches.
- Expiry dates.
- Stock ledger.
- FEFO.
- Receiving.
- Adjustments.
- Stock counts.
- Transfers.

### Milestone 4: Online and Offline POS

- Barcode checkout.
- Payments.
- Receipts.
- Cash sessions.
- Offline cache.
- Offline outbox.
- Synchronization.
- Refunds and voids.

### Milestone 5: Pharmacy Operations

- Prescriptions.
- Controlled products.
- Notifications.
- Expiry workflows.
- Supplier returns.
- Customer history.

### Milestone 6: Reports and SaaS

- Sales reports.
- Cash reports.
- Inventory reports.
- Tax/VAT reports.
- Exports.
- Subscription plans.
- Usage limits.

### Milestone 7: Bangladesh Pilot

- Validate with real pharmacy staff.
- Validate payment and hardware workflows.
- Validate offline operation.
- Validate reports and cash reconciliation.
- Resolve usability and regulatory gaps.

### Milestone 8: EU/Germany Readiness

- Add Germany country profile.
- Validate German pharmacy requirements.
- Validate German VAT rules.
- Add EUR and locale support.
- Add German payment and receipt requirements.
- Review EU privacy and retention requirements.
- Perform a separate compliance assessment.

## 12. Cross-Cutting Technical Requirements

- Use a modular monolith initially.
- Keep frontend, application, domain, and persistence responsibilities separate.
- Use PostgreSQL transactions for sales, payments, and stock movements.
- Use immutable stock and financial ledgers.
- Use idempotency for payments, offline synchronization, and background jobs.
- Enforce tenant and branch scope at every data-access boundary.
- Keep country behavior in configuration and policy services.
- Use provider interfaces for payments, authentication, storage, notifications, and hardware.
- Use background workers for notifications and large reports.
- Use structured logs and correlation IDs.
- Never log prescription contents, credentials, payment secrets, or unnecessary personal data.

## 13. Testing Roadmap

### Unit Tests

- FEFO allocation.
- Expiry blocking.
- Tax and VAT calculation.
- Currency and rounding rules.
- Discounts.
- Refund behavior.
- Cash reconciliation.
- Permission evaluation.
- Country policy behavior.
- Offline conflict rules.

### Integration Tests

- Purchase receiving to batch stock.
- Sale to stock ledger and payment.
- Refund to stock restoration.
- Cash session settlement.
- Payment provider callbacks.
- Offline synchronization.
- Notification retries.
- Tenant and branch filtering.

### End-to-End Tests

- Receive a purchase.
- Create batches.
- Sell by barcode.
- Prevent expired sale.
- Allocate FEFO stock.
- Complete an offline sale.
- Reconnect and synchronize.
- Process a refund.
- Close a cash session.
- Generate reports.
- Send low-stock and expiry alerts.

### Security and Reliability Tests

- Tenant-isolation tests.
- Unauthorized action tests.
- Concurrent sale tests.
- Duplicate payment tests.
- Duplicate synchronization tests.
- Rate-limit tests.
- Prescription access tests.
- Backup restoration tests.
- Offline data privacy tests.

## 14. Definition of Done

Every roadmap task is complete only when:

- The functionality is implemented.
- Server-side authorization is enforced.
- Tenant and branch scope is tested.
- Validation and error handling are present.
- Audit behavior is implemented where required.
- Automated tests are added.
- API documentation is updated.
- Responsive behavior is verified where applicable.
- Offline behavior is verified where applicable.
- Database migrations are included.
- Linting, type checking, and tests pass.

## 15. Initial Execution Order

The recommended first implementation sequence is:

1. Finalize Bangladesh regulatory assumptions and offline policies.
2. Set up the local Docker development environment.
3. Set up the React/Vite frontend and NestJS backend.
4. Implement authentication, tenants, branches, RBAC, and audit logging.
5. Implement configurable country, currency, timezone, tax, and pharmacy policies.
6. Implement product catalog and suppliers.
7. Implement batch inventory, stock ledger, and FEFO.
8. Implement purchasing and receiving.
9. Implement online POS and payment records.
10. Implement offline POS synchronization.
11. Implement cash sessions, refunds, and voids.
12. Implement prescriptions and controlled-product rules.
13. Implement notifications and reports.
14. Validate hardware and run the Bangladesh pilot.
15. Harden the system for production.
16. Begin a separate EU/Germany compliance and localization phase.

Do not build the final POS workflow before tenant isolation, permissions, product identity, stock ledger rules, and offline transaction rules are defined.
