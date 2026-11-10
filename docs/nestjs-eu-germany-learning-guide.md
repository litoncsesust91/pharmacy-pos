# NestJS Learning And Interview Guide

This guide uses the Pharmacy POS project as the reference application. It is designed to move from understanding the codebase to being able to design, explain, test, and operate a NestJS service in a European production environment.

## How To Use This Guide

For every topic:

1. Read the concept.
2. Open the referenced project files.
3. Explain the request lifecycle aloud.
4. Complete the suggested exercise.
5. Answer the interview questions without looking at the text.

The most important NestJS principle is separation of concerns:

```text
HTTP transport -> Controller -> Guard/Pipe -> Service -> Prisma -> PostgreSQL
                                      |
                              business authorization
```

Controllers should coordinate HTTP. Services should enforce business rules. Guards should establish identity and permissions. Prisma should persist data through explicit tenant-scoped queries.

---

## 1. Modules And Dependency Injection

### The Concept

A NestJS module is a boundary around related controllers, providers, imports, and exports.

```ts
@Module({
  imports: [PrismaModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
```

Dependency injection means Nest creates a class and supplies its dependencies through the constructor:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly audit: AuditService,
) {}
```

Nest builds a dependency graph. When `SalesController` needs `SalesService`, and `SalesService` needs `PrismaService`, Nest resolves the graph from module metadata.

### Project Examples

- `apps/api/src/app.module.ts` is the application composition root.
- `apps/api/src/sales/sales.module.ts` owns sales routes and service logic.
- `apps/api/src/prisma/prisma.module.ts` exposes `PrismaService`.
- `apps/api/src/jobs/jobs.module.ts` exports `JobsService` to `ReportsModule`.
- `SubscriptionsModule` is imported by catalog, tenants, and sales because those features enforce subscription limits.

### Important Rules

- A provider must be in the current module or imported from a module that exports it.
- `imports` makes another module's exported providers available.
- `exports` exposes a provider to importing modules.
- `controllers` should not contain database or domain logic.
- Avoid making every module global. Global modules hide dependencies and make tests harder to understand.
- Prefer feature modules with explicit dependencies.

### Provider Types

Most providers are classes:

```ts
providers: [SalesService]
```

Custom providers are useful for adapters:

```ts
{
  provide: BILLING_PROVIDER,
  useClass: LocalBillingProvider,
}
```

Other options include `useValue`, `useFactory`, and `useExisting`.

### Interview Questions

- What is the difference between `imports` and `exports`?
- How does Nest resolve a constructor dependency?
- When would you use a custom provider token?
- What problems can excessive global modules create?
- How would you replace a payment provider in tests?

### Exercise

Create a `StockAlertModule` with a `StockAlertService`. Export the service and inject it into `JobsService`. Write a test that overrides the service with a fake implementation.

---

## 2. Controllers, DTOs, Pipes, And Validation

### Controllers

A controller maps HTTP requests to application operations:

```ts
@Controller('sales')
export class SalesController {
  @Get()
  @RequirePermissions('sales.read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: SaleQueryDto) {
    return this.sales.listSales(user, query);
  }
}
```

The controller should handle:

- Route mapping.
- Reading parameters, query values, and request bodies.
- Calling the correct service method.
- Selecting the HTTP response behavior.

It should not decide whether stock is available or whether a prescription is valid.

### DTOs

DTO means Data Transfer Object. It defines the input contract at the transport boundary:

```ts
export class CreateSaleDto {
  @IsString()
  @Length(1, 80)
  saleNumber!: string;

  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines!: SaleLineDto[];
}
```

DTOs are not Prisma models. A DTO describes what a client is allowed to send. A Prisma model describes persistence.

### ValidationPipe

This project enables a global pipe in `main.ts`:

```ts
new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidUnknownValues: true,
})
```

Important options:

- `whitelist`: removes properties without validation decorators.
- `forbidNonWhitelisted`: rejects unknown properties instead of silently removing them.
- `transform`: converts values such as query-string numbers into DTO types.
- `transformOptions`: controls implicit conversion behavior.
- `exceptionFactory`: lets you standardize validation errors.

For high-security APIs, consider enabling `forbidNonWhitelisted: true` after checking client compatibility.

### Pipes

Pipes transform or validate input before a controller method runs.

Built-in examples:

```ts
@Param('id', ParseUUIDPipe) id: string
```

Custom pipes are useful for:

- Normalizing IDs.
- Parsing date ranges.
- Validating tenant or branch identifiers.
- Converting a string into a domain value object.

### Interview Questions

- Why should DTOs not be reused as Prisma input types?
- What does `whitelist` protect against?
- Where should business validation such as “stock cannot go negative” live?
- How would you validate nested arrays?
- What is the difference between a pipe and middleware?

### Exercise

Add a DTO for a stock transfer. Validate positive quantities, distinct source/destination branches, bounded notes, and nested line items. Keep the final authorization and stock validation in the service.

---

## 3. Guards, Decorators, Authentication, And RBAC

### Authentication Versus Authorization

- Authentication answers: “Who is this caller?”
- Authorization answers: “May this caller perform this action?”

The project uses JWTs for authentication and database-loaded permissions for authorization.

### Guard Flow

The global `AuthenticationGuard`:

1. Checks whether the route is public.
2. Extracts the Bearer token.
3. Verifies the JWT signature and expiry.
4. Reloads the user, tenant, branches, roles, permissions, and subscription state.
5. Attaches `AuthenticatedUser` to the request.

The global `PermissionsGuard`:

1. Reads permissions declared by `@RequirePermissions()`.
2. Reads the authenticated user from the request.
3. Requires every declared permission to be present.

```ts
@RequirePermissions('payments.refund')
@Post('refunds')
createRefund(...) {}
```

### Decorators

This project defines:

- `@Public()` to bypass authentication.
- `@RequirePermissions()` to attach authorization metadata.
- `@CurrentUser()` to extract the authenticated user.

The decorator should declare intent. The guard should enforce it.

### RBAC Design

The data model is:

```text
User -> UserRole -> Role -> RolePermission -> Permission
User -> UserBranch -> Branch
User -> Tenant
```

Good RBAC practice:

- Default deny.
- Enforce authorization on the API, not only in React.
- Use least privilege.
- Separate approval permissions from creation permissions.
- Audit sensitive actions.
- Revalidate current user state instead of trusting stale JWT claims.

### EU/Germany Interview Topics

Be prepared to discuss:

- Session revocation after role removal.
- MFA for owners and pharmacists.
- Data minimization under GDPR.
- Access logging for prescriptions and personal data.
- Processor/controller responsibilities.
- Access requests and deletion exceptions for financial records.
- Why frontend route hiding is not authorization.

### Interview Questions

- Why reload permissions from the database instead of putting all permissions in the JWT?
- How would you revoke all sessions for a user?
- How would you implement an owner-only subscription screen?
- How do you prevent a user from changing `tenantId` in a request body?
- What is the difference between a guard and an interceptor?

### Exercise

Implement a `@RequireAnyPermission()` decorator and guard behavior. Add tests for missing authentication, missing permission, and successful authorization.

---

## 4. Prisma Transactions, Isolation, And Tenant Scoping

### Prisma In This Project

`PrismaService` wraps `PrismaClient`. Services use Prisma for typed queries, relations, constraints, and transactions.

Every tenant-owned query should start with an explicit scope:

```ts
where: {
  tenantId: user.tenantId,
  branchId: { in: user.branchIds },
}
```

Never accept `tenantId` from an untrusted request body when it can be derived from the authenticated user.

### Transactions

Use a transaction when multiple writes must succeed or fail together:

```ts
await this.prisma.$transaction(async (transaction) => {
  const sale = await transaction.sale.create({ data: saleData });
  await transaction.saleLine.createMany({ data: lines });
  await transaction.paymentTransaction.create({ data: payment });
  return sale;
});
```

The sale service uses a serializable transaction for stock allocation. This protects the invariant that two concurrent checkouts cannot both consume the same stock.

### Isolation Levels

Common PostgreSQL isolation levels:

- `Read Committed`: each statement sees committed data at statement start. PostgreSQL default.
- `Repeatable Read`: all statements see a consistent snapshot.
- `Serializable`: transactions behave as if executed one at a time; conflicts can fail and must be retried.

Higher isolation improves consistency but can increase conflicts and retries.

Use serializable isolation for operations such as:

- FEFO stock allocation.
- Cash-session closing with reconciliation.
- Idempotent financial writes.

Do not hold long external API calls inside a database transaction.

### Idempotency

Offline clients and payment providers retry. The schema uses unique tenant-scoped idempotency keys:

```text
(tenantId, idempotencyKey)
```

The service checks for an existing operation and returns the original result rather than creating a duplicate.

### Tenant-Scoping Checklist

- Include `tenantId` in every read and write.
- Restrict branches with `user.branchIds`.
- Validate related IDs belong to the same tenant.
- Do not expose raw Prisma queries from controllers.
- Add cross-tenant tests for every sensitive feature.
- Consider PostgreSQL Row-Level Security for defense in depth.

### Interview Questions

- What happens when a serializable transaction conflicts?
- Why is a read followed by a write unsafe without a transaction?
- How do unique constraints help idempotency?
- How would you test tenant isolation?
- When should a transaction be avoided?

### Exercise

Write an integration test that creates two tenants with similarly named products and proves tenant A cannot read, update, sell, or report on tenant B's product.

---

## 5. Exception Filters, Middleware, Interceptors, And Request Lifecycle

### Request Lifecycle

The simplified NestJS HTTP lifecycle is:

```text
Middleware
  -> Guards
    -> Interceptors (before)
      -> Pipes
        -> Controller
          -> Service
        <- Controller result
      <- Interceptors (after)
  <- Exception filters if an error occurs
```

Exact ordering can vary by global, controller, and method scope, so know the documented lifecycle when combining components.

### Middleware

Middleware receives the raw request and response:

```ts
(request, response, next) => {
  request.requestId = createRequestId();
  response.setHeader('x-request-id', request.requestId);
  next();
}
```

Use middleware for:

- Correlation IDs.
- Raw request logging.
- Rate limiting.
- Request normalization.

Do not put authorization decisions in generic middleware because guards have better route metadata and execution context.

### Interceptors

Interceptors wrap handler execution and can transform, measure, cache, or time requests:

```ts
return next.handle().pipe(
  tap(() => metrics.recordDuration(Date.now() - started)),
);
```

Use interceptors for:

- Timing and metrics.
- Response envelopes.
- Serialization.
- Caching.
- Timeout policies.

Avoid hiding important business behavior inside interceptors.

### Exception Filters

The project filter logs request IDs and error names without logging passwords, tokens, or request bodies. It then delegates the response to Nest's standard exception handling.

Production error responses should expose:

- A stable error code.
- A human-readable safe message.
- A request ID for support.

They should not expose stack traces, SQL, secrets, or personal data.

### Interview Questions

- What is the lifecycle order of middleware, guards, pipes, interceptors, and filters?
- Why is authorization usually implemented in guards rather than middleware?
- How would you add request timing without changing controllers?
- What information should never be logged?
- How would you return a consistent error format?

### Exercise

Add a timing interceptor that records route duration and an exception filter that returns `{ requestId, code, message }` while hiding internal errors.

---

## 6. Testing Modules And Real HTTP Integration Tests

### Unit Tests

Unit tests isolate a service or guard by mocking dependencies:

```ts
const module = await Test.createTestingModule({
  providers: [
    SalesService,
    { provide: PrismaService, useValue: prismaMock },
    { provide: AuditService, useValue: auditMock },
  ],
}).compile();
```

Use unit tests for:

- Pure business decisions.
- Guard behavior.
- DTO-adjacent logic.
- Error conditions.
- Retry and idempotency branches.

### Integration Tests

Integration tests use real Nest modules and often a real test database. They verify that routing, guards, pipes, Prisma, and serialization work together.

Typical setup:

```ts
const module = await Test.createTestingModule({
  imports: [AppModule],
}).compile();

const app = module.createNestApplication();
app.setGlobalPrefix('api');
await app.init();
```

With Supertest:

```ts
await request(app.getHttpServer())
  .post('/api/auth/login')
  .send(credentials)
  .expect(201);
```

### What To Test In This Project

- Login and subscription entitlement revalidation.
- Permission matrix for sales, refunds, prescriptions, and billing.
- Cross-tenant and cross-branch access.
- Concurrent stock allocation.
- Sale idempotency and offline replay.
- Payment webhook signature and replay protection.
- Prescription document token expiry and tenant scope.
- Report export authorization and formula protection.
- Rate-limit behavior.

### Test Isolation

For PostgreSQL integration tests:

- Use a dedicated database.
- Apply migrations before the suite.
- Use unique test tenants or truncate inside controlled transactions.
- Never point tests at production.
- Avoid test order dependence.

### Interview Questions

- What should be mocked in a unit test and what should be real in an integration test?
- How do you test a global guard?
- How do you test database transaction behavior?
- How do you prevent test data leaking between tests?
- What is the difference between a unit, integration, and E2E test?

### Exercise

Build an HTTP test that logs in the seeded owner, creates a sale, retries the same idempotency key, and verifies that only one sale exists.

---

## 7. Queues, Lifecycle Hooks, Graceful Shutdown, And Worker Separation

### Queues

This project uses BullMQ with Redis for deferred work:

```text
HTTP request -> BackgroundJob row -> BullMQ -> Redis -> Worker -> PostgreSQL/notifications
```

The database record provides tenant-owned job visibility. Redis provides queue coordination, retries, and delayed execution.

### Why Queues Matter

Do not block checkout or an HTTP report request with:

- Email delivery.
- Large exports.
- Reconciliation.
- Expiry scans.
- External provider calls.

Queue jobs should be:

- Idempotent.
- Retryable.
- Tenant-scoped.
- Observable.
- Safe to run more than once.

### Lifecycle Hooks

`JobsService` uses:

- `OnModuleInit` to start the worker and schedule polling.
- `OnModuleDestroy` to stop timers and close workers/queues.

Always close database pools, Redis clients, HTTP clients, and queue workers during graceful shutdown.

### Graceful Shutdown

Production shutdown should:

1. Stop accepting new traffic.
2. Mark the instance unready.
3. Finish or safely requeue active jobs.
4. Close HTTP, database, and Redis connections.
5. Exit before the orchestrator deadline.

Nest can enable shutdown hooks:

```ts
app.enableShutdownHooks();
```

### Worker Separation

The current worker runs inside the API process for local simplicity. Production should usually separate:

```text
api process    -> handles HTTP
worker process -> handles BullMQ jobs
scheduler      -> creates scheduled jobs
```

This prevents a large export or failed worker from reducing API capacity.

### Interview Questions

- What happens if a worker crashes after the database write but before acknowledgement?
- How do you make a job idempotent?
- Why should workers be separate from API processes?
- How do retries interact with external side effects?
- How do you drain a queue during deployment?

### Exercise

Create a `REPORT_EXPORT` worker that stores a completed export, marks failures, and can safely retry the same job without creating duplicate export records.

---

## 8. Configuration, Environment Validation, Swagger, And Production Deployment

### Configuration

Configuration should be loaded once, validated at startup, and injected rather than read randomly throughout the application.

This project currently uses `ConfigModule` and environment variables for:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `WEB_ORIGINS`
- S3-compatible storage settings
- Billing and document secrets

A production-grade configuration schema should fail startup when required values are missing or malformed:

```ts
const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(32).required(),
});
```

Never log complete environment variables. Never commit real `.env` files.

### Swagger

Swagger is generated from controllers, DTOs, and decorators:

```ts
const config = new DocumentBuilder()
  .setTitle('Pharmacy POS API')
  .setVersion('0.1.0')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

Document:

- Authentication schemes.
- Request and response DTOs.
- Error responses.
- Permission requirements.
- Pagination and filtering.

In production, protect Swagger or disable it at the edge.

### Production Deployment

A reliable NestJS deployment needs:

- Immutable build artifacts.
- `npm ci` with a lockfile.
- Database migrations using `prisma migrate deploy`.
- Secrets from a secret manager.
- HTTPS termination.
- Explicit CORS origins.
- Liveness and readiness endpoints.
- Structured logs and request IDs.
- Graceful shutdown.
- Redis and PostgreSQL health checks.
- Backups and tested restores.
- Rollback procedures.

The repository runbooks are in `docs/deployment.md` and `docs/backup-restore.md`.

### EU/Germany Production Expectations

Be ready to discuss:

- GDPR data minimization and purpose limitation.
- Data processing agreements and subprocessors.
- EU data residency.
- Encryption in transit and at rest.
- Secret rotation and key management.
- Audit-log retention and access controls.
- Right of access and deletion exceptions for accounting records.
- Incident response and breach notification.
- VAT/invoice requirements as a business/legal integration, not merely a code setting.

### Interview Questions

- How do you validate environment variables before application startup?
- What is the difference between `prisma migrate dev` and `prisma migrate deploy`?
- How should secrets be supplied in Kubernetes or a cloud platform?
- How do liveness and readiness differ?
- How would you deploy a database migration safely?
- What should be disabled or protected in production Swagger?

### Exercise

Add startup configuration validation for all required production environment variables. Add an integration test that fails application startup when `JWT_SECRET` is missing in production mode.

---

## Final Interview Checklist

You should be able to explain:

- How a request travels through middleware, guards, pipes, controllers, services, Prisma, and filters.
- How Nest resolves dependencies and how you replace providers in tests.
- How JWT authentication differs from permission authorization.
- How tenant and branch scope is enforced at every data boundary.
- Why sales use transactions, isolation, and idempotency keys.
- How to test the real HTTP application with a test database.
- How Redis and BullMQ differ from PostgreSQL.
- How workers shut down and how jobs remain safe during retries.
- How configuration is validated and secrets are managed.
- How to deploy, monitor, back up, restore, and roll back a NestJS service.

The strongest interview answers connect framework mechanics to business risk: duplicate payments, unsafe stock, unauthorized prescription access, tenant data leakage, unavailable services, and unrecoverable production data.
