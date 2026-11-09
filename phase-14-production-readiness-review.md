# Phase 14: Security, Performance, and Production Readiness

## Delivered

- Added request IDs through `x-request-id` response/request correlation.
- Added structured HTTP exception logging without request bodies, credentials, or personal data.
- Added process-local rate limiting: 10 requests/minute for authentication paths and 120 requests/minute for other API paths.
- Replaced permissive CORS with explicit `WEB_ORIGINS` allowlisting.
- Added CSP and production Helmet configuration.
- Added `/api/health/ready` database readiness checks.
- Added sales and payment query indexes for cashier, payment method, status, and time-range access.
- Added deployment, rollback, encrypted backup, restore, and operational runbooks.

## Security Tests

- Existing tenant, branch, permission, idempotency, and subscription entitlement tests remain in the regression suite.
- Health readiness is isolated from liveness so load balancers do not route traffic to an API with an unavailable database.
- Rate-limit and request-context middleware are unit-testable without external services.

## Intentionally Deferred

- Distributed rate limiting for multiple API replicas.
- External error tracking and alert delivery integration.
- Full load, concurrent checkout, offline-scale, penetration, and physical disaster-recovery exercises.
- Automated encrypted backup scheduling and cloud object-storage retention.

## Remaining Risks

- Process-local limits do not coordinate across replicas.
- Backup commands require an operator-managed secret and secure off-host storage.
- Physical restore, hardware, and compliance validation require the deployment environment.
