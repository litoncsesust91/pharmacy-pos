Pharmacy POS Plan
The image highlights four pharmacy-specific realities:

Batch and expiry control: stock cannot be treated as a single product quantity. Sales must use FIFO/FEFO and track each batch.
Fast retail POS: barcode scanning, keyboard shortcuts, and low-latency checkout are essential.
Strict RBAC: owner, manager, pharmacist, cashier, and warehouse staff must have different access.
Background automation: low-stock, expiry, daily sales, and pharmacy-debt notifications should run asynchronously.
The repository currently contains only .git, so this should be planned as a greenfield system.

1. Product Scope
Core modules
Tenant and SaaS Management
Organizations, branches, subscriptions, plans, billing
Tenant data isolation
Branch-level configuration
Trial, suspension, and subscription limits
User, Staff, and RBAC
Owner
Admin
Branch manager
Pharmacist
Cashier
Inventory officer
Accountant
Auditor/read-only user
Fine-grained permissions such as sale.refund, stock.adjust, report.view, and user.manage
Product Catalog
Product name and generic name
Brand/company
Category/group
Strength, dosage form, pack size, unit
Barcode and alternate barcodes
Prescription-required flag
Controlled-drug flag
Tax/VAT configuration
Minimum and reorder quantity
Supplier and purchase price
Selling price and discount rules
Batch and Inventory
Batch number
Manufacturing date
Expiry date
Purchase cost
Selling price
Quantity received, sold, reserved, damaged, and adjusted
FEFO allocation for sales
Near-expiry and expired stock
Stock ledger with immutable movements
Branch-to-branch stock transfer
Stock count and reconciliation
Damaged, lost, recalled, and returned stock
Purchasing
Suppliers
Purchase orders
Goods receiving
Partial receiving
Batch entry during receiving
Purchase returns
Supplier payment tracking
Sales POS
Barcode scanner support
Fast product search
Keyboard shortcuts
Cart and suspended sales
Discounts and taxes
Cash, card, mobile wallet, and mixed payments
Customer invoice/receipt
Sale cancellation and refund workflow
Prescription attachment or reference where required
Offline-safe behavior should be evaluated for poor connectivity
Customers and Prescriptions
Customer profile and contact details
Doctor and prescription reference
Prescription image/file
Repeat medication history
Customer credit or due balance, if legally and commercially required
Privacy controls for medical information
Cash and Transactions
Cash register opening and closing
Cash-in and cash-out
Shift management
Payment reconciliation
Refund records
Daily, monthly, and yearly cash reports
Difference between expected and counted cash
Transaction audit trail
Reports
Sales by day, month, year, branch, cashier, product, company, and group
Gross profit and margin
Purchase report
Stock valuation
Low-stock report
Expired and near-expiry report
Fast-moving and slow-moving products
Tax/VAT report
Refund and void report
Cashier settlement report
Supplier payable report
Notifications and Jobs
Minimum stock alerts
Reorder suggestions
Expiry alerts: configurable 30/60/90 days
Expired product alerts
Failed payment or synchronization alerts
Daily sales summary
Email, in-app, SMS, or push notification
Background job retries and failure monitoring
2. Critical Business Rules
Stock must be tracked at product plus batch plus branch level.
Sales should allocate stock using FEFO: first-expiring, first-out.
Expired stock must not be saleable.
Near-expiry stock should be clearly marked and optionally blocked based on configuration.
Stock changes must happen through ledger movements, never by directly overwriting quantity.
Refunds should restore the original batch where possible.
Every void, adjustment, discount override, refund, and permission change must be audited.
Financial transactions should be immutable; corrections should use reversal transactions.
All timestamps should be stored consistently, with tenant/branch timezone configuration.
Product deletion should generally be soft deletion because historical sales depend on product records.
3. Recommended Architecture
Start with a modular monolith, not microservices. It is easier to develop, test, deploy, and operate while retaining clear boundaries for future extraction.

Suggested structure:

Identity and access
Tenant and branch management
Catalog
Inventory
Purchasing
Sales
Payments and cash
Customers and prescriptions
Notifications
Reporting
Audit
Recommended infrastructure:

Relational database such as PostgreSQL
Redis for caching, locks, and queues
Background worker for notifications and reports
Object storage for prescriptions and documents
REST or typed API
Responsive web application/PWA
Centralized logging and error tracking
Automated backups and restore testing
Use domain services for rules such as:

StockAllocationService
SaleService
RefundService
CashSettlementService
PermissionService
ExpiryNotificationService
Keep controllers thin and avoid placing business logic in UI components or database procedures.

4. Important Data Model
Core entities:

Tenant
Subscription
Branch
User
Role
Permission
Product
Category
Company
Supplier
Customer
Prescription
ProductBatch
StockLedgerEntry
PurchaseOrder
GoodsReceipt
Sale
SaleItem
Payment
Refund
CashRegister
CashSession
StockTransfer
Notification
AuditLog
The most important relationship is:

Tenant
  -> Branch
      -> ProductBatch
          -> StockLedgerEntry
              -> SaleItem / Purchase / Adjustment / Transfer
5. Delivery Phases
Phase 0: Discovery and compliance
Confirm country-specific pharmacy, tax, VAT, prescription, and controlled-drug requirements.
Define tenant, branch, currency, timezone, and pricing rules.
Identify supported payment providers and receipt printers.
Define the first target customer: single pharmacy or multi-branch operator.
Create UX flows for POS, receiving, stock adjustment, and cash closing.
Phase 1: SaaS foundation
Authentication and tenant creation
Branch management
RBAC and permission checks
Product, company, group, supplier, and customer setup
Audit logging
Responsive application shell
Phase 2: Inventory and purchasing
Batch-aware product receiving
Stock ledger
FEFO allocation
Stock adjustment and stock count
Supplier returns
Low-stock and expiry dashboards
Import products from CSV/Excel
Phase 3: POS and transactions
Barcode scanning
Fast search and keyboard navigation
Cart, suspended sale, and checkout
Multiple payment methods
Receipt printing/PDF
Refunds and voids
Cash register opening/closing
Daily cashier settlement
Phase 4: Reporting and notifications
Daily/monthly/yearly reports
Profit and stock valuation
Expiry and low-stock notifications
Scheduled reports
Export to CSV/PDF
Notification preferences and delivery history
Phase 5: Production hardening
Performance testing at checkout
Security testing
Backup and disaster recovery
Monitoring and alerting
Data migration tools
Subscription enforcement
Pilot deployment with real pharmacy staff
Training and operational documentation
6. Security and SaaS Requirements
Enforce tenant isolation at every query and service boundary.
Use server-side authorization; frontend hiding is not security.
Support MFA for owners and administrators.
Use secure password reset and session expiry.
Encrypt sensitive data in transit and at rest.
Protect prescription documents with private access URLs.
Maintain audit logs for sensitive actions.
Rate-limit login, payment, and public endpoints.
Add database backups, point-in-time recovery, and restore drills.
Define retention and deletion policies for customer and prescription data.
7. Mobile and POS UX
Desktop should prioritize cashier speed:

Barcode-first interaction
Large cart and payment controls
Keyboard shortcuts
Minimal page transitions
Clear stock and expiry warnings
Mobile should support:

Inventory lookup
Stock receiving
Approval workflows
Reports
Notifications
Customer lookup
Manager actions
Do not force the desktop POS layout onto small screens. Use separate responsive interaction patterns.

8. Testing Strategy
Unit tests for FEFO, expiry blocking, tax, discounts, refunds, and cash calculations
Integration tests for sale-to-stock-ledger behavior
Authorization tests for every sensitive permission
Tenant-isolation tests
End-to-end tests for receiving, selling, refunding, and closing cash
Concurrency tests for two cashiers selling the same batch
Property/invariant tests ensuring stock cannot become inconsistent
Performance tests for barcode search and checkout
Backup restore testing
Accessibility and responsive browser testing
9. MVP Boundary
The first usable release should include:

Multi-tenant and branch foundation
RBAC
Product catalog
Batch-aware inventory
FEFO sales allocation
Purchasing and receiving
Barcode POS
Cash register and payments
Refunds
Low-stock and expiry alerts
Daily/monthly/yearly sales and cash reports
Audit logs
Responsive web interface
Defer until after the pilot:

Advanced accounting integration
Loyalty programs
Complex insurance claims
Full offline synchronization
Automated supplier ordering
AI forecasting
Multi-country tax support
Native mobile applications
The guiding design principle should be: financial and stock records are append-only, permissions are explicit, and every pharmacy-specific rule is tested independently.

create a requirements.md file with everything that mentioned
Clarifying read-only mode limitations

I’m currently in read-only plan mode, so I cannot create or modify requirements.md.

Planned change:

Create requirements.md at the repository root.
Include all previously defined requirements:
SaaS and multi-tenant architecture
Inventory and batch/expiry tracking
FEFO stock allocation
POS and barcode workflows
Purchasing and suppliers
Sales, refunds, and transactions
Cash register and daily/monthly/yearly reports
RBAC and staff roles
Notifications and background jobs
Customers and prescriptions
Reporting and filtering
Mobile responsiveness
Security, audit logs, backups, and compliance
Architecture principles: SOLID, DRY, KISS
Data model
Delivery phases
MVP scope
Testing and production-readiness requirements