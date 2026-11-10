# Remaining Roadmap Gaps

This file records features intentionally left undeveloped after the locally feasible work was completed. They require external providers, physical devices, major product screens, or dedicated operational environments.

## Phase 1: Foundation

- Production worker/email-capture/Keycloak services: require deployment topology and identity/email infrastructure.
- Production secrets and environment management: require a deployment platform and secret manager.

## Phase 2: Identity And Access

- OIDC/OAuth2, MFA, password recovery, invitations, refresh-token sessions, and PostgreSQL RLS: require an identity design, mail delivery, session revocation strategy, and database policy rollout.
- Full authorization matrix and tenant-isolation integration tests: require a dedicated E2E test environment.

## Phase 3: Business Configuration

- Versioned policy approvals, rollback, and pharmacy-specific policy adapters: require product decisions about approval ownership and historical policy semantics.
- Invoice/receipt configuration: requires final fiscal and jurisdiction-specific requirements.

## Phase 4: Catalog

- File-based CSV/Excel import and attachment workflows: require upload limits, storage, parsing rules, and error-report UX.
- Formula-injection-safe catalog exports: requires a catalog export surface; report exports now escape spreadsheet formulas.

## Phase 5: Inventory

- Stock counts, reconciliation, and branch transfers: require count-session UX and transfer approval rules.
- Complete movement taxonomy and broad concurrency/load tests: require operational scenarios and a multi-session test harness.

## Phase 6: Purchasing

- Purchasing anomaly detection and full receiving integration suite: require expected-cost/quantity thresholds and representative supplier data.

## Phase 7: Offline POS

- Offline permission/settings/stock snapshots, stale-stock conflict resolution, and operator conflict UX: require an offline entitlement policy and product decisions for unsafe sales.
- Offline-scale and reconnect load tests: require browser/device test infrastructure.

## Phase 8: Payments

- Live payment providers, tokenization, mixed payments, provider reconciliation, and production webhook verification: require provider accounts, credentials, and compliance review.
- Refund stock restoration: requires an approved inventory reversal policy for partial and batch-specific refunds.

## Phase 9: Prescriptions

- Cloud object storage integration and retention deletion jobs: requires an approved S3/MinIO production bucket, key-management policy, and retention schedule.
- Physical prescription scanning/OCR: requires hardware/provider selection.

## Phase 10: Jobs

- Dedicated worker deployment, email/push adapters, and external alerting: require separate process hosting and provider credentials.
- Scheduled report generation: queued jobs currently record/report job state; durable large-export materialization needs a worker-to-reports orchestration design.

## Phase 11: Reports

- Frontend report/manager screens: require navigation and role-specific UX design.
- Distributed large-export processing and object-storage delivery: require worker deployment and storage lifecycle management.
- PDF fidelity and financial reconciliation certification: require business-owner sample reports.

## Phase 12: Subscriptions

- Production billing provider and billing portal: require provider account, checkout, tax, invoice, and webhook contracts.
- Complete plan-limit coverage for every domain entity: requires finalized commercial plan definitions.

## Phase 13: Hardware

- Physical scanner, receipt printer, cash drawer, and label printer validation: requires target devices and supported OS/browser combinations.
- Authenticated local hardware bridge: requires a signed local bridge protocol and installation/upgrade process.
- Tablet inventory, receiving, and mobile manager screens: require additional frontend routes and UX designs.

## Phase 14: Operations

- Distributed rate limiting, external error tracking, alerting, load tests, penetration tests, container scans, automated encrypted backups, restore drills, and compliance reviews: require production infrastructure, security tooling, and accountable operators.
- Bangladesh and Germany compliance sign-off: requires legal/accounting review; code alone cannot establish compliance.
