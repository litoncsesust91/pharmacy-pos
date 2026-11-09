# Phase 01: Local Foundation Review

## Status

Completed.

## Phase File Convention

After each phase is completed, create one review file using this naming format:

```text
phase-XX-<phase-name>-review.md
```

Planned review files:

```text
phase-01-local-foundation-review.md
phase-02-tenants-auth-rbac-review.md
phase-03-country-business-configuration-review.md
phase-04-product-catalog-review.md
phase-05-batch-inventory-fefo-review.md
phase-06-purchasing-receiving-review.md
phase-07-offline-pos-sales-review.md
phase-08-payments-cash-management-review.md
phase-09-prescriptions-controlled-products-review.md
phase-10-notifications-background-jobs-review.md
phase-11-reports-exports-review.md
phase-12-saas-subscriptions-review.md
phase-13-responsive-ux-hardware-review.md
phase-14-production-readiness-review.md
```

Every phase review must contain:

- Phase status and scope.
- Implemented features.
- Why each feature was developed.
- How each feature should be tested.
- Verification results.
- Known limitations and risks.
- QA interview questions and expected answers.
- Technology and architecture decisions.
- Why the selected logic is being used.
- Follow-up work for the next phase.

## Scope Delivered

Phase 1 established the local technical foundation for the pharmacy POS SaaS platform.

### Repository Foundation

- npm workspace monorepo.
- React and Vite frontend workspace.
- NestJS backend workspace.
- Shared TypeScript compiler configuration.
- Environment variable template.
- Git ignore rules.
- Prettier configuration.

### Backend Foundation

- NestJS application bootstrap.
- Global configuration module.
- Global validation pipe.
- Helmet security headers.
- CORS support for local development.
- API prefix at `/api`.
- Swagger documentation at `/api/docs`.
- Health endpoint at `/api/health`.
- Initial API unit test.

### Database Foundation

- PostgreSQL Docker service.
- Prisma schema and client generation.
- Initial migration.
- Seed script.
- Initial `SystemInfo` table for migration and seed verification.

### Local Infrastructure

- PostgreSQL container.
- Redis container.
- Optional MinIO S3-compatible storage container.
- Persistent Docker volumes.
- Service health checks for PostgreSQL and Redis.

### Frontend Foundation

- Vite development server.
- Responsive application shell.
- Initial mobile layout behavior.
- Initial web unit test.

### Quality Foundation

- TypeScript checks.
- ESLint.
- Jest API tests.
- Vitest frontend tests.
- Production build scripts.
- GitHub Actions CI workflow.

## Security Features Implemented

- Helmet security headers.
- Global request validation.
- Request property whitelisting.
- Unknown-value rejection.
- Environment-based configuration.
- `.env` exclusion from version control.
- Dependency lockfile.
- Strict TypeScript checks.
- ESLint checks.
- Automated unit tests.
- Production build verification.
- Docker isolation for local PostgreSQL and Redis services.

These controls establish a safe development baseline. They do not provide authentication, RBAC, tenant isolation, audit logging, or production-grade secrets management yet.

## Security Testing

- Verify security headers on API responses.
- Submit unknown request properties and confirm validation rejects them.
- Confirm `.env` is ignored by Git.
- Run dependency installation from the lockfile.
- Run type checking, linting, tests, and production builds.
- Confirm local infrastructure is isolated to the development Docker environment.

## Why These Features Were Developed

### npm Workspaces

The frontend and backend are separate applications but share one repository and one dependency workflow. Workspaces provide a simple monorepo structure without introducing Nx or Turborepo before the project needs that complexity.

### React and Vite

The POS will require interactive cart management, barcode input, keyboard shortcuts, responsive layouts, and future offline support. React and Vite provide a fast client application suitable for those requirements.

### NestJS

The backend will contain multiple domains such as inventory, sales, purchasing, payments, RBAC, reports, and notifications. NestJS provides modules, dependency injection, guards, and a consistent application structure for those domains.

### PostgreSQL

Pharmacy inventory and financial workflows require relational consistency, transactions, constraints, and complex reporting. PostgreSQL is the source of truth for future stock and financial records.

### Prisma

Prisma provides typed database access and migration management. Raw SQL can still be used later for FEFO locking, concurrency-sensitive stock allocation, and complex reporting queries.

### Redis

Redis will support background jobs, notifications, caching, offline synchronization coordination, and distributed locking without turning those concerns into database polling.

### Docker Compose

Docker Compose makes local development reproducible. Every developer can use the same PostgreSQL and Redis versions without manually installing or configuring services.

### Global Validation

The global validation pipe gives all future endpoints consistent input handling. `whitelist` prevents unexpected properties from entering application logic, and `transform` supports typed request DTOs.

### Helmet

Security headers are foundational. Adding them before sensitive pharmacy, customer, prescription, and financial data exists reduces the chance of forgetting baseline browser protections later.

### Swagger

Swagger provides a shared API contract for frontend development, manual testing, QA testing, and future integrations.

### Health Endpoint

The health endpoint gives local development, CI, Docker, and future deployment systems a deterministic way to confirm that the API process is running.

### Initial Minimal Database Model

Only the `SystemInfo` model exists in Phase 1. This verifies Prisma generation, migrations, and seeding without prematurely locking the pharmacy domain model before tenant, branch, RBAC, inventory, and audit requirements are designed together.

### Optional MinIO Profile

Document storage is required later for prescriptions and operational files, but it should not prevent the base PostgreSQL and Redis development environment from starting. MinIO is therefore an optional Docker profile until document workflows are implemented.

## Test Strategy

## Automated Verification

Run the following commands from the repository root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

All four commands must pass before Phase 1 is considered complete.

## API Smoke Test

Start the API and verify:

```text
GET http://localhost:3000/api/health
```

Expected result:

```json
{
  "status": "ok",
  "service": "pharmacy-pos-api"
}
```

Also verify that Swagger is available at:

```text
http://localhost:3000/api/docs
```

## Infrastructure Test

Start local services:

```bash
docker compose up -d
docker compose ps
```

Verify:

- PostgreSQL is running and healthy.
- Redis is running and healthy.
- Persistent volumes are created.
- Prisma migration completes successfully.
- Seed command completes successfully.

To include local object storage:

```bash
docker compose --profile storage up -d
```

## Frontend Test

Start the frontend:

```bash
npm run dev --workspace @pharmacy-pos/web
```

Verify:

- The page loads at `http://localhost:5173`.
- The layout works on desktop width.
- The cards stack on mobile width.
- The page has readable contrast.
- The page contains no browser console errors.

## QA Interview

### QA: Why is the project split into frontend and backend workspaces?

Expected answer: The POS UI and API have different runtime concerns and deployment needs. Separate workspaces keep boundaries clear while allowing shared repository tooling and CI.

### QA: Why is a modular monolith being used instead of microservices?

Expected answer: The product is still establishing core pharmacy rules. A modular monolith reduces operational complexity while preserving domain boundaries that can be extracted later if justified.

### QA: What must be tested for the health endpoint?

Expected answer: It must return HTTP 200 and the expected JSON structure when the API process is healthy. It must not require authentication because deployment probes need to access it.

### QA: Why does the API use the `/api` prefix?

Expected answer: It separates API routes from future frontend routes and makes reverse-proxy, versioning, and monitoring rules clearer.

### QA: Why is validation global instead of repeated in controllers?

Expected answer: Global validation provides consistent behavior and prevents endpoints from accidentally accepting unvalidated input. Domain-specific rules will still be implemented in DTOs and domain services.

### QA: Why is PostgreSQL the primary database?

Expected answer: Stock, batches, payments, cash, and audit records require transactions, relationships, constraints, and reliable reporting. PostgreSQL provides those guarantees.

### QA: Why is Redis not the source of truth?

Expected answer: Redis is optimized for temporary and fast-access data. Financial and stock records must remain durable and transactional in PostgreSQL.

### QA: Why is the initial Prisma model minimal?

Expected answer: The domain model will be designed in Phase 2 around tenant, branch, user, role, and audit boundaries. A premature schema would create migration and data-integrity problems.

### QA: How should database setup be tested on a clean machine?

Expected answer: Start Docker services, run Prisma generate, run the migration, run the seed, and confirm the database is queryable. The setup must not depend on an existing local database state.

### QA: What is the purpose of the migration file?

Expected answer: It records the exact database change so every environment can reproduce the same schema. Manual database changes are not acceptable.

### QA: Why is MinIO optional in Phase 1?

Expected answer: Prescription and document storage is not yet part of the implemented workflow. Making MinIO optional keeps the base development environment focused and reliable while preserving the planned S3-compatible interface.

### QA: How should responsive behavior be tested?

Expected answer: Test the web application at desktop, tablet, and narrow mobile widths. Confirm that content remains readable, cards stack correctly, and no horizontal scrolling occurs.

### QA: Why are both Jest and Vitest used?

Expected answer: Jest is aligned with the NestJS backend ecosystem, while Vitest provides a fast Vite-native frontend test runner. They are isolated by workspace and run through the root test command.

### QA: What should CI block?

Expected answer: CI must block merges when dependency installation, type checking, linting, tests, or production builds fail.

### QA: What security behavior exists in this phase?

Expected answer: Helmet, input validation, and controlled CORS are established. Authentication, authorization, tenant isolation, and sensitive-data controls are intentionally deferred to Phase 2 and must not be assumed to exist yet.

## Known Limitations

- Authentication is not implemented yet.
- RBAC is not implemented yet.
- Tenant isolation is not implemented yet.
- Inventory and financial domain models are not implemented yet.
- MinIO requires the optional storage profile.
- CORS is permissive for local development and must be restricted before production.
- The frontend is a foundation screen, not a POS workflow.
- No prescription or customer data should be stored yet.

## Phase Review

Phase 1 meets its intended scope. The repository can install dependencies, run local PostgreSQL and Redis, execute Prisma migrations and seed data, serve a NestJS API, serve a React frontend, run automated checks, and produce production builds.

The phase is ready for Phase 2: tenants, branches, authentication, RBAC, and audit foundations.

## Next Phase

Phase 2 will implement:

- Tenants.
- Branches.
- Users and invitations.
- Roles and permissions.
- Authentication integration.
- Tenant and branch request context.
- Backend authorization guards.
- Audit-log foundation.
- Tenant-isolation tests.
