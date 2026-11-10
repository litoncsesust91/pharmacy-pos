# NestJS In This Project

## What NestJS Provides

NestJS is the backend framework for the Pharmacy POS SaaS application. It provides a structured TypeScript application model built around modules, controllers, providers, dependency injection, decorators, guards, pipes, and middleware.

The API runs from `apps/api/src/main.ts` and exposes REST endpoints under `/api`.

## What Has Been Built

The backend is organized by business capability rather than by technical layer:

- `auth`: JWT authentication, Argon2 password verification, permission guards, and tenant revalidation.
- `tenants`: tenants, branches, users, and branch access boundaries.
- `catalog`: products, companies, groups, suppliers, barcodes, customers, and catalog search.
- `inventory`: batches, expiry controls, FEFO allocation, stock ledgers, and idempotent movements.
- `purchasing`: purchase orders, approvals, receiving, returns, payables, and supplier payments.
- `sales`: offline-compatible sales, suspended tickets, prescription checks, totals, and stock allocation.
- `payments`: payments, cash sessions, refunds, reconciliation, and webhook handling.
- `prescriptions`: prescription approval workflows and encrypted document access.
- `jobs`: BullMQ background jobs, retries, notifications, failed-job handling, and schedules.
- `reports`: tenant-scoped sales, cash, profit, inventory, expiry, refund, tax, and export reports.
- `subscriptions`: plans, trials, limits, usage, lifecycle changes, and billing-provider abstraction.
- `health` and `observability`: liveness/readiness checks, request IDs, rate limiting, secure headers, and structured errors.

Prisma is used as the database access layer. PostgreSQL stores tenant-owned business data, while Redis supports background queues. The React frontend consumes the API and provides the offline-first POS shell.

## Why These Features Matter

- **Tenant and branch scoping** prevents one pharmacy or branch from reading another branch's data.
- **RBAC and guards** enforce permissions on the server rather than relying on frontend visibility.
- **Transactions and idempotency** prevent duplicate sales, duplicate payments, and inconsistent stock.
- **FEFO and batch controls** are essential for pharmacy expiry and recall safety.
- **Offline sales and synchronization** support unreliable connectivity at the counter.
- **Audit logs** make sensitive financial, inventory, prescription, and subscription actions traceable.
- **Background jobs** keep notifications and large work away from request/response paths.
- **Reports and exports** provide operational and financial visibility without bypassing tenant security.
- **Subscription enforcement** makes plan limits and suspension behavior server-side concerns.
- **Observability and readiness checks** make the API diagnosable and deployable.

## Important NestJS Concepts Used Here

### Modules

Modules group related controllers and providers and define dependency boundaries. Examples include `SalesModule`, `InventoryModule`, `ReportsModule`, and `SubscriptionsModule`.

Study:

- `imports`, `providers`, `controllers`, and `exports`
- feature-module boundaries
- shared/global modules
- circular dependency avoidance

### Controllers

Controllers map HTTP requests to application operations. For example, `SalesController` maps routes such as `POST /api/sales` to `SalesService.createSale()`.

Study:

- route decorators such as `@Get`, `@Post`, and `@Patch`
- route parameters, query strings, and request bodies
- response handling and status codes
- Swagger decorators

### Providers and Dependency Injection

Services contain business logic and receive dependencies through constructors:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly audit: AuditService,
) {}
```

Study:

- provider scopes and lifecycle
- constructor injection
- custom providers and tokens
- replacing providers in tests
- dependency inversion for billing and storage adapters

### Guards

Guards run before controller handlers. This project uses authentication and permission guards to establish the current user and enforce RBAC:

- `AuthenticationGuard` validates the JWT and reloads current tenant/user state.
- `PermissionsGuard` checks `@RequirePermissions(...)` metadata.

Study:

- `CanActivate`
- `ExecutionContext`
- metadata with `SetMetadata`
- `Reflector`
- authentication versus authorization

### Custom Decorators

`@CurrentUser()` extracts the authenticated user from the request. `@Public()` bypasses authentication for health and selected public routes.

Study how parameter decorators reduce repeated request plumbing while keeping authorization in guards.

### Pipes and DTO Validation

The global `ValidationPipe` validates DTOs and removes unknown properties. DTOs use `class-validator` and `class-transformer` for input boundaries.

Study:

- `whitelist`
- transformation of query and body values
- nested DTO validation
- custom validation pipes
- rejecting malformed or unexpected input

### Middleware

Middleware runs before route handling. This project uses middleware for request IDs and rate limiting.

Study:

- request/response middleware
- ordering and scope
- proxy-aware client IP handling
- when middleware is preferable to guards or interceptors

### Exception Filters

The HTTP exception filter logs structured request metadata without logging credentials or request bodies, then delegates response formatting to NestJS.

Study:

- `ExceptionFilter`
- `ArgumentsHost`
- consistent error contracts
- safe error logging

### Lifecycle Hooks

The background job service uses `OnModuleInit` and `OnModuleDestroy` to start and close BullMQ workers safely.

Study:

- `OnModuleInit`
- `OnModuleDestroy`
- graceful shutdown
- connection cleanup
- worker lifecycle management

### Database Integration

`PrismaService` is a Nest provider wrapping the Prisma client. Business services use it for tenant-scoped queries and transactions.

Study:

- Prisma transactions inside Nest services
- transaction isolation levels
- migrations and generated clients
- repository/service boundaries
- preventing unscoped queries

### Testing

The project uses Jest for API unit tests and Vitest for web tests. Services are tested with mocked providers, while security-sensitive behavior should increasingly receive integration and end-to-end coverage.

Study:

- `TestingModule`
- provider overrides
- mocked Prisma boundaries
- guard and middleware tests
- Supertest-based HTTP tests
- database-backed tenant-isolation tests

## Recommended Deep-Dive Order

1. Modules and dependency injection.
2. Controllers, DTOs, pipes, and validation.
3. Guards, decorators, authentication, and RBAC.
4. Prisma transactions, isolation, and tenant scoping.
5. Exception filters, middleware, interceptors, and request lifecycle.
6. Testing modules and real HTTP integration tests.
7. Queues, lifecycle hooks, graceful shutdown, and worker separation.
8. Configuration, environment validation, Swagger, and production deployment.

The most important rule for further development is to preserve the existing boundary: controllers handle transport concerns, services enforce business rules, guards enforce access, Prisma handles persistence, and every tenant-owned query must include an explicit tenant boundary.
