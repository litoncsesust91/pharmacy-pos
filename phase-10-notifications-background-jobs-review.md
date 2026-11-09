# Phase 10: Notifications and Background Processing Review

## Status

Completed.

## Feature Review

Phase 10 introduces asynchronous processing with Redis and BullMQ:

- Redis-backed BullMQ queue and worker.
- Tenant-scoped background job records.
- Low-stock notifications.
- Near-expiry notifications.
- Expired-stock notifications.
- Daily sales summary notifications.
- Scheduled report job records.
- In-app notifications with read state.
- Per-user notification preferences.
- Exponential retry configuration.
- Failed-job monitoring and retry endpoint.
- Tenant-scoped report schedules.
- Idempotent job and notification deduplication.

## Why These Features Were Implemented

Low-stock, expiry, and summary calculations should not delay checkout or other request/response operations. BullMQ moves those workloads to a worker while PostgreSQL retains durable job state for auditing and operational recovery.

Notifications are persisted in the database instead of being emitted only from Redis. This prevents users from losing alerts during reconnects and lets the application deduplicate repeated schedules and retries.

Per-user preferences prevent unwanted alert channels and reduce sensitive-data exposure. The initial implementation supports in-app delivery while retaining email and push preference fields for later adapters.

Failed-job records are kept separately from BullMQ’s transient state so administrators can inspect errors, enforce retry limits, and intentionally retry a failed job.

## Logic Behind the Implementation

1. An authorized user submits an allow-listed job type and tenant-scoped dedupe key.
2. The service persists a `BackgroundJob` before adding the job to BullMQ.
3. BullMQ runs jobs with three attempts and exponential backoff.
4. The worker marks the durable record `RUNNING`, executes the job, then marks it `COMPLETED`.
5. Worker failures mark the record `FAILED` with a bounded error message.
6. Low-stock jobs compare product minimum stock against the sum of available batch quantities.
7. Expiry jobs select positive stock while excluding recalled and quarantined batches.
8. Notification dedupe keys prevent the same alert from being created repeatedly for one user.
9. Notification preferences are checked before in-app notifications are created.
10. Scheduled reports are tenant-owned and create allow-listed report jobs when due.
11. All queue-management and preference changes are authenticated and permission-controlled.

## API

```text
GET   /api/notifications
PATCH /api/notifications/:notificationId/read
GET   /api/notification-preferences
PATCH /api/notification-preferences
POST  /api/jobs
GET   /api/jobs/failed
POST  /api/jobs/:jobId/retry
GET   /api/report-schedules
POST  /api/report-schedules
```

## Security Risks Handled

- Queue abuse: only allow-listed job types can be queued.
- Cross-tenant jobs: every durable job and notification includes tenant scope.
- Duplicate notifications: tenant/user/dedupe-key uniqueness is enforced by PostgreSQL.
- Duplicate jobs: tenant/dedupe-key uniqueness prevents repeated active work.
- Retry exhaustion: BullMQ has a maximum of three attempts and durable failure state.
- Sensitive logs: only bounded error text is stored; job payloads must be validated objects.
- Notification privacy: users can read only their own tenant notifications.
- Preference privacy: users can update only their own preferences.
- Schedule abuse: schedules are created under the authenticated tenant and allow-listed report types.
- Checkout blocking: background calculations are asynchronous and do not run inside sales transactions.
- Expiry alerts: recalled and quarantined batches are excluded from normal expiry notifications.

## Interview QA

### Why use both BullMQ and PostgreSQL job records?

BullMQ provides queue execution, retries, and worker concurrency. PostgreSQL provides durable tenant-scoped status, auditability, and operational retry visibility.

### What happens when a worker crashes?

BullMQ retries the job according to its retry policy. The durable record remains available for monitoring and can be retried through the authorized API if it ultimately fails.

### Can the same low-stock notification be created repeatedly?

No. The notification has a tenant/user/dedupe-key unique constraint and uses `skipDuplicates`.

### Can a user read another user’s notifications?

No. Notification reads require both the authenticated tenant ID and authenticated user ID.

### Can clients queue arbitrary code or job names?

No. Only the five allow-listed job types are accepted.

### Does a report schedule execute with another tenant’s data?

No. The schedule and generated job retain the schedule’s tenant ID, which every worker query uses.

### Why are email and push preferences present if only in-app delivery exists?

The preference model establishes user consent before future adapters are enabled. No email or push is sent in this phase.

### What remains for later phases?

Email/push adapters, cron expression parsing, a dedicated worker process, dashboards, and advanced report generation remain follow-up work.

## Testing Procedure

### Testing Credentials

```text
Email:       owner@demo.local
Password:    ChangeMe123!
Tenant slug: demo-pharmacy
Branch:      user.branchIds[0] returned by login
Redis:       redis://localhost:6379
```

The seeded owner receives Phase 10 notification and job permissions. These credentials are for local development only.
BullMQ requires Redis 5 or newer; use the Redis 7 service from `docker-compose.yml` rather than an older host Redis installation.

### Automated Checks

```powershell
docker compose up -d postgres redis
npm.cmd run db:generate --workspace @pharmacy-pos/api
npm.cmd run db:migrate --workspace @pharmacy-pos/api
npm.cmd run db:seed --workspace @pharmacy-pos/api
npm.cmd run typecheck --workspace @pharmacy-pos/api -- --incremental false
npm.cmd run lint --workspace @pharmacy-pos/api
npm.cmd test --workspace @pharmacy-pos/api
npm.cmd run typecheck --workspace @pharmacy-pos/web
npm.cmd run lint --workspace @pharmacy-pos/web
npm.cmd test --workspace @pharmacy-pos/web
npm.cmd run build
```

Expected results:

- Redis and PostgreSQL are available.
- Migration and seed are repeatable with schema version `phase-10`.
- API tests cover notification isolation, unsupported job rejection, and read authorization.
- API and web checks pass and the production build completes.

### API Manual Verification

1. Login with the testing credentials and save the access token.
2. Queue a `LOW_STOCK` job with a unique dedupe key through `POST /api/jobs`.
3. Confirm the job is created and later becomes `COMPLETED`.
4. Repeat the same dedupe key and confirm no duplicate active job is created.
5. Query `GET /api/notifications` and confirm the owner receives the alert.
6. Mark the notification read and confirm `readAt` is populated.
7. Disable `lowStock` in notification preferences and repeat the job; confirm no new low-stock notification appears.
8. Queue `NEAR_EXPIRY` and `EXPIRED_STOCK` jobs and confirm eligible batch notifications are created.
9. Queue `DAILY_SALES_SUMMARY` and confirm the notification contains only aggregate count and total.
10. Create a report schedule with a due `nextRunAt` and confirm the scheduler queues a report job.
11. Request `GET /api/jobs/failed` and confirm only the current tenant’s failures are visible.
12. Retry a failed job and confirm a new attempt is queued with a bounded retry policy.
13. Submit an unsupported job type and expect `409`.
14. Attempt another user’s notification ID and expect `404`.
15. Attempt another tenant’s job ID and expect `404`.

### Failure and Security Tests

- Stop Redis and confirm the API does not expose another tenant’s job data; queued work remains inspectable in PostgreSQL.
- Use malformed job payloads and confirm validation rejects them.
- Force a worker error and confirm attempts and `lastError` are recorded without secrets.
- Retry a failed job past the limit and confirm it remains failed rather than looping indefinitely.
- Queue duplicate notification work and confirm one notification per user/dedupe key.
- Scan job and notification logs for passwords, payment credentials, prescription documents, or raw personal documents.
- Confirm notification preference updates cannot target another user.

## Known Limitations

- Email and push delivery adapters are not active yet.
- Schedule parsing currently advances due schedules by one day; full cron parsing is deferred.
- Worker execution is hosted in the API process in development; production should run a dedicated worker process.
- Failed-job error text is bounded but should receive structured redaction rules before production.

## Next Phase

Phase 11 will implement shared reports, financial and inventory reporting, CSV/PDF exports, expiring export links, and background processing for large reports.
