# Phase 09: Customers, Prescriptions, and Controlled Products Review

## Status

Completed.

## Feature Review

Phase 9 extends customer records with regulated prescription workflows:

- Prescription records linked to tenant customers.
- Prescriber identity, license, issue date, expiry date, notes, and product authorization lines.
- Pending, approved, rejected, and expired prescription states.
- Pharmacist approval with separation of duties.
- Prescription-required and controlled-product enforcement during sales.
- Tenant policy controls for prescription approval and controlled-product approval.
- Protected prescription document metadata with MIME and 10 MB size limits.
- Tenant-scoped object keys and five-minute document access tokens.
- Soft document deletion for retention workflows.
- Restricted prescription and document permissions.
- Prescription creation, approval, access, upload, and deletion audit events.

## Why These Features Were Implemented

Prescription-required and controlled products cannot rely on a product flag alone. The sale must prove that an authorized customer prescription exists, is approved, is not expired, includes the product, and allows the requested quantity.

Prescription documents contain medical information and must not be exposed through ordinary catalog or customer endpoints. The API stores document metadata and a private object key rather than file bytes or public URLs, which keeps storage access behind an authorization check.

Approval is separate from creation so the person entering a prescription cannot silently approve their own record. Tenant policy flags allow a country or business configuration to require or relax approval without changing the sales model.

## Logic Behind the Implementation

1. A prescription is created for a tenant customer with one or more authorized products.
2. New prescriptions enter `PENDING_APPROVAL` when approval is required.
3. The creator cannot approve or reject the same prescription.
4. Approval records the pharmacist user and timestamp.
5. A sale involving a prescription-required or controlled product must reference an approved, unexpired prescription for the same customer.
6. The prescription must contain the product and, when configured, the requested quantity must not exceed the authorized quantity.
7. Offline high-risk restrictions from Phase 7 still apply even when a prescription exists.
8. Documents accept only PDF, JPEG, or PNG metadata and are limited to 10 MB.
9. Document access returns a five-minute HMAC access token tied to the document and expiry time.
10. Document deletion is soft deletion so retention and legal-hold workflows can be added without losing audit identity.
11. Every prescription and document access action is tenant-scoped and audited.

## API

```text
GET    /api/prescriptions
POST   /api/prescriptions
POST   /api/prescriptions/:prescriptionId/review
GET    /api/prescriptions/:prescriptionId/documents
POST   /api/prescriptions/:prescriptionId/documents
GET    /api/prescriptions/:prescriptionId/documents/:documentId/access
DELETE /api/prescriptions/:prescriptionId/documents/:documentId
```

## Security Risks Handled

- Cross-tenant prescription access is rejected by tenant-scoped queries.
- Prescription creators cannot approve their own prescriptions.
- Expired prescriptions cannot authorize sales.
- Controlled products are blocked when tenant policy disables them.
- Prescription-required and controlled products cannot be sold without approved authorization.
- Offline high-risk sales remain blocked by Phase 7 policy.
- Document access requires a dedicated least-privilege permission.
- Public document URLs are never returned.
- Document access tokens expire after five minutes.
- Allowed document types and maximum document size are validated server-side.
- Documents use tenant-scoped private object keys and soft deletion.
- Medical-data access is audited.
- No prescription document bytes, card credentials, or secrets are stored in browser storage.

## Interview QA

### Why is a prescription linked to a customer?

Authorization belongs to a specific patient/customer. A prescription cannot be reused across tenants or silently applied to another customer.

### Can the cashier approve a prescription they created?

No. The service rejects self-approval and requires a separate authorized user.

### Can an expired prescription be used?

No. Sales require an approved prescription whose expiry is absent or later than the current server time.

### Can a prescription authorize any product?

No. Each regulated product must appear in the prescription authorization lines, and authorized quantity is enforced when supplied.

### Are prescription documents publicly downloadable?

No. The API returns a short-lived access token only after authentication, tenant checks, permission checks, and document checks.

### Why is document deletion soft deletion?

Retention, audit, and legal-hold requirements may require preserving document identity after it is removed from active use.

### What happens when controlled products are disabled by policy?

The sales service rejects controlled-product sales, regardless of the client request.

### Why are PDF, JPEG, and PNG the only accepted types?

They cover common prescription formats while reducing parser and malware exposure. Additional formats require explicit review.

### What remains incomplete?

Actual object-storage upload/download adapters, encryption-at-rest configuration, retention jobs, pharmacist role administration, and country-specific regulatory adapters remain future work.

## Testing Procedure

### Testing Credentials

Use the seeded local account:

```text
Email:       owner@demo.local
Password:    ChangeMe123!
Tenant slug: demo-pharmacy
Branch:      user.branchIds[0] returned by login
```

The seeded owner receives the Phase 9 permissions for local verification. Do not use these credentials outside local development.

### Automated API Checks

```powershell
npm.cmd run db:generate --workspace @pharmacy-pos/api
npm.cmd run db:migrate --workspace @pharmacy-pos/api
npm.cmd run db:seed --workspace @pharmacy-pos/api
npm.cmd run typecheck --workspace @pharmacy-pos/api -- --incremental false
npm.cmd run lint --workspace @pharmacy-pos/api
npm.cmd test --workspace @pharmacy-pos/api
npm.cmd run build --workspace @pharmacy-pos/api
```

Expected results:

- The Phase 9 migration applies successfully.
- Seed execution is repeatable and sets schema version `phase-9`.
- API tests pass, including tenant isolation, self-approval rejection, document access restriction, and controlled-product policy checks.

### API Manual Verification

1. Login with the testing credentials and save the access token.
2. Create a customer through `POST /api/sales/customers`.
3. Create a prescription for that customer with a regulated product and a future expiry date.
4. Confirm its status is `PENDING_APPROVAL`.
5. Attempt approval with the creator and expect `403`.
6. Approve the prescription with another authorized user and confirm `APPROVED`.
7. Create a completed sale for the regulated product without `prescriptionId` and expect `403`.
8. Create the sale with the approved prescription ID and confirm it succeeds online.
9. Attempt a sale after the prescription expiry and expect `403`.
10. Add a PDF document metadata record and confirm it is listed.
11. Attempt an unsupported MIME type or size above 10 MB and expect validation failure.
12. Request document access and confirm the token includes a five-minute expiry.
13. Request document access as another tenant/user without `prescription.document` and expect `403` or `404`.
14. Delete the document and confirm it no longer appears in active document listings.
15. Confirm prescription creation, approval, document access, upload, and deletion are audited.

### Web/API Checks

```powershell
npm.cmd run typecheck --workspace @pharmacy-pos/web
npm.cmd run lint --workspace @pharmacy-pos/web
npm.cmd test --workspace @pharmacy-pos/web
npm.cmd run build
```

1. Open the POS and connect with email, password, tenant slug `demo-pharmacy`, and the assigned branch ID.
2. Confirm an invalid branch value is replaced by the assigned branch from login.
3. Confirm regulated offline sales remain blocked.
4. Confirm no prescription documents or medical notes are written to IndexedDB or session storage.
5. Confirm expired browser sessions cannot synchronize high-risk sales.

### Security Test Matrix

- Unauthorized prescription access rejection.
- Expired prescription sale rejection.
- Prescription download/access audit verification.
- Controlled-product approval enforcement.
- Offline high-risk operation rejection.
- Invalid document type rejection.
- Oversized document rejection.
- Cross-tenant customer and prescription rejection.
- Self-approval rejection.
- Soft deletion and retention identity verification.

## Known Limitations

- This phase stores private document metadata and object keys; actual object storage adapters are deferred.
- Access tokens are authorization tokens for the future storage adapter, not direct file downloads yet.
- Retention/deletion scheduling is deferred to Phase 10 background processing.
- Pharmacist role creation and country-specific rules remain configuration work.

## Next Phase

Phase 10 will implement notifications and background processing for low stock, near expiry, expired stock, daily summaries, scheduled reports, retries, and failed-job monitoring.
