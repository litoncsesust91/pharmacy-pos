# Deployment Runbook

## Release

1. Set production `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `WEB_ORIGINS`, and `BILLING_WEBHOOK_SECRET`.
2. Run `npm ci`.
3. Run `npm run db:migrate --workspace @pharmacy-pos/api -- --deploy`.
4. Run `npm run db:seed` only for a new environment or explicitly reviewed seed changes.
5. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
6. Start the API with `npm run start --workspace @pharmacy-pos/api` and serve `apps/web/dist` from the approved HTTPS origin.
7. Verify `/api/health`, `/api/health/ready`, and Swagger access policy.

## Rollback

- Stop new API instances, retain the previous application artifact, and restore traffic to it.
- Do not automatically roll back migrations. Review the migration and use a forward fix unless a tested down migration exists.
- Restore the database only when data corruption is confirmed and the restore point is approved by the incident owner.

## Production Controls

- TLS terminates at the reverse proxy; do not expose PostgreSQL or Redis publicly.
- `WEB_ORIGINS` must contain explicit HTTPS origins, not `*`.
- Keep Swagger private or disable it at the edge for production.
- Rate limiting in this release is process-local; use an edge or Redis-backed limiter when running multiple API replicas.
