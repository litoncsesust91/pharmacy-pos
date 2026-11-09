# Phase 02: Tenants, Authentication, and RBAC Review

## Status

Completed.

## Scope

Phase 2 establishes the first real security boundary for the application:

- Tenants.
- Branches.
- Users.
- Roles.
- Permissions.
- Authentication.
- Server-side authorization.
- Tenant and branch scoping.
- Audit logging.

## Implemented Features

### Tenant and Branch Model

- Tenant model with active status and unique slug.
- Branch model scoped to a tenant.
- Unique branch code per tenant.
- User-to-branch assignments.
- Tenant-scoped branch queries.
- Branch access checks.

### User and RBAC Model

- Tenant-scoped users.
- Active/inactive user state.
- Tenant-scoped roles.
- Global permission definitions.
- User-to-role assignments.
- Role-to-permission assignments.
- Default owner role in seed data.

### Authentication

- Local email and password login for development.
- Argon2 password hashing.
- Short-lived JWT access tokens.
- Active user and active tenant checks during token use.
- Generic invalid-credential response.
- Production JWT secret requirement.

The authentication service is kept behind an application boundary so it can later be replaced or supplemented with an OIDC provider such as Keycloak or a managed identity provider.

### Authorization

- Global authentication guard.
- Public-route decorator for health and login endpoints.
- Permission metadata decorator.
- Global permission guard.
- Default denial for protected endpoints.
- Server-side permission evaluation from current database state.
- No reliance on frontend route hiding.

### Audit Logging

- Tenant-scoped audit log model.
- Actor tracking.
- Action and entity tracking.
- Optional entity ID and metadata.
- Login-success audit event.
- Branch-creation audit event.
- Timestamp and request metadata fields for future request integration.

### API Endpoints

```text
POST /api/auth/login
GET  /api/tenant/me
GET  /api/branches
POST /api/branches
GET  /api/branches/:branchId
```

### Local Seed Account

```text
Tenant:  demo-pharmacy
Email:   owner@demo.local
Password: ChangeMe123!
```

This account is for local development only and must not be used in a deployed environment.

## Why These Features Were Developed

### Tenant Scoping

The application is SaaS. Tenant scope must exist before pharmacy records are introduced so product, stock, sales, customers, and reports cannot be designed without isolation boundaries.

### Branch Scoping

The pilot starts with one branch but the data model supports multiple branches. Users are assigned to branches so future stock and sales APIs can enforce operational boundaries.

### Database-Backed Permissions

Permissions are resolved from the database on each authenticated request rather than trusted entirely from JWT claims. This makes role removal effective before token expiration and reduces stale authorization risk.

### Argon2 Password Hashing

Argon2 is designed for password hashing and is more appropriate than general-purpose hashes. Raw passwords are never stored.

### Short-Lived JWTs

Short-lived access tokens reduce the impact of token theft. A later phase can add refresh-token rotation or delegate session management to an OIDC provider.

### Global Guards

Authentication and permissions are applied centrally so new endpoints are protected by default. Public endpoints must explicitly opt out with `@Public()`.

### Tenant-Scoped Query Conditions

Services include `tenantId` directly in database filters. This is the primary application-level defense against cross-tenant access and will be strengthened with database-level controls if required.

### Not Found for Unauthorized Branches

A branch outside the authenticated user's assignment returns `404` rather than `403`. This avoids revealing whether an inaccessible branch exists.

### Immutable Audit Records

Audit logs record sensitive actions without replacing the underlying business data. This creates a history for investigation and future compliance workflows.

## Security Features Implemented

- Global authentication guard.
- Explicit public-route opt-out.
- Global permission guard.
- Default-deny protected endpoints.
- Argon2 password hashing.
- Short-lived access tokens.
- Production JWT secret validation.
- Active-user validation on every authenticated request.
- Active-tenant validation on every authenticated request.
- Tenant-scoped database queries.
- Branch-assignment enforcement.
- Generic invalid-login response.
- Tenant-scoped audit logs.
- Login and branch-creation audit events.
- Input validation for login and branch creation.
- Duplicate branch-code protection.

## Test Strategy

### Automated Tests

Run:

```powershell
npm run typecheck --workspace @pharmacy-pos/api -- --incremental false
npm run lint --workspace @pharmacy-pos/api
npm test --workspace @pharmacy-pos/api
npm run build --workspace @pharmacy-pos/api
```

Tests currently cover:

- Permission success.
- Permission denial.
- Unauthenticated permission access.
- Tenant ID inclusion in branch queries.
- Branch assignment enforcement.
- Health endpoint behavior.

### Database Verification

```powershell
npm run db:generate
npm run db:migrate --workspace @pharmacy-pos/api -- --name tenants_auth_rbac
npm run db:seed
```

Verify that:

- Tenant, branch, user, role, permission, assignment, and audit tables exist.
- Seed execution is repeatable.
- Unique tenant slug and branch-code constraints work.
- Password hashes are not plaintext.

### API Security Verification

1. Request `/api/tenant/me` without a token and expect `401`.
2. Login with the seeded account and receive a token.
3. Request `/api/tenant/me` with the token and expect `200`.
4. Request `/api/branches` with the token and expect only authorized branches.
5. Create a branch with the owner permission and expect `201`.
6. Create the same branch code again and expect `409`.
7. Use an invalid token and expect `401`.
8. Use a user without `branch.manage` and expect `403`.
9. Attempt to access a branch outside the user's assignment and expect `404`.
10. Confirm successful login and branch creation create audit records.

## Verification Results

Passed:

- Prisma client generation.
- Database migration.
- Repeatable seed execution.
- API type checking.
- API linting.
- API build.
- Three API test suites.
- Six API unit tests.
- Health endpoint smoke test.
- Unauthenticated endpoint rejection.
- Demo login.
- Tenant retrieval.
- Branch retrieval.
- Branch creation.
- Duplicate branch-code rejection.

## QA Interview

### QA: Why is login tenant-aware?

Expected answer: The same email could exist in separate organizations. Requiring a tenant slug avoids ambiguous identity resolution and ensures the user is authenticated into an explicit tenant context.

### QA: Why are permissions loaded from the database instead of trusted from the JWT?

Expected answer: Database-backed checks make role and permission removal effective immediately. JWT claims can become stale until token expiry.

### QA: What happens when a user is deactivated after receiving a token?

Expected answer: The guard reloads the user and checks `isActive` on every request, so the token is rejected even if it has not expired.

### QA: What happens when a tenant is deactivated?

Expected answer: The authenticated-user query requires an active tenant, so access is denied.

### QA: Why does an unauthorized branch return `404`?

Expected answer: Returning `404` avoids disclosing the existence of branches the user is not assigned to.

### QA: Why are public routes explicit?

Expected answer: Protected-by-default behavior prevents a newly added endpoint from accidentally becoming unauthenticated.

### QA: Why is the health endpoint public?

Expected answer: Infrastructure probes must verify process health without requiring user credentials. It must not expose tenant or business data.

### QA: What is the limitation of local JWT authentication?

Expected answer: It is suitable for local development, but production should use a properly managed OIDC provider, secure secret management, MFA, refresh-token policy, and account recovery controls.

### QA: Why is Argon2 used?

Expected answer: It is a password-specific, memory-hard hash that makes brute-force attacks more expensive than plain hashing or fast general-purpose hashes.

### QA: How is cross-tenant access tested?

Expected answer: Create two tenants, authenticate as a user from Tenant A, and verify every tenant-scoped endpoint excludes Tenant B data even when Tenant B IDs are supplied directly.

### QA: What should be audited?

Expected answer: Authentication success, user and role changes, permission changes, branch changes, and all future stock, sale, refund, cash, and configuration changes.

### QA: Why is branch assignment separate from tenant membership?

Expected answer: A user may belong to an organization but only be allowed to operate selected branches. This supports least privilege for multi-branch pharmacies.

### QA: What is the failure behavior when the database is unavailable?

Expected answer: Protected requests fail closed rather than trusting stale authorization data. Readiness checks and graceful error handling will be expanded later.

## Known Limitations and Risks

- OIDC integration is not implemented yet.
- Refresh-token rotation is not implemented.
- Login rate limiting and account lockout are not implemented.
- MFA is not implemented.
- Request IP and user-agent are not yet passed into every audit event.
- PostgreSQL Row-Level Security is not enabled.
- No user-management API exists yet.
- The seeded password is intentionally known and local-only.
- The local JWT fallback secret must never be used in production.
- Permission changes do not yet have an approval workflow.

## Next Phase

Phase 3 will implement country and business configuration:

- Country profile.
- Bangladesh configuration.
- Currency.
- Timezone.
- Locale formatting.
- Tax/VAT policies.
- Pharmacy policies.
- Prescription and controlled-product policies.
- Configuration authorization and audit behavior.
