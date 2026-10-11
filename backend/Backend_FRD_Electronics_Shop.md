# Backend Functional Requirements Document (FRD)

**Electronics Shop Management System**  
**Version:** 1.0 | **Date:** October 2026

## 1. Purpose and Scope

This document defines backend requirements for a responsive public catalogue and an authenticated owner portal serving one owner with two separate shops. Backend is the source of truth for product data, inventory, sales, payments, tax treatment, invoices and reporting.

Proposed stack: Node.js, Express.js, PostgreSQL and Prisma ORM. Cloudinary is used for product image storage. The API must enforce shop-level data isolation and transactional consistency.


## 2. Architecture and Core Principles

Expose versioned REST endpoints under /api/v1.

Use PostgreSQL as the source of truth; use Prisma for schema, migrations and queries.

Use database transactions for completing a sale and recording related stock movements/payment/invoice data.

Store money using PostgreSQL Decimal/Numeric fields rather than floating-point types. Define rounding rules centrally.

Use UTC timestamps in storage and display shop-local dates consistently in reports.

Maintain an auditable record of inventory movements, sale-item price/cost snapshots, cancellations and adjustments.


## 3. Authentication and Shop Isolation

Support owner authentication at POST /api/v1/auth/login, session inspection at GET /api/v1/auth/me and logout at POST /api/v1/auth/logout.

Represent each shop as a Shop record. Associate authenticated owner identities with the shop(s) they are permitted to access.

Every shop-owned record must carry shopId directly or be reachable through a parent record whose shopId is validated.

Derive the authorized shop context from the authenticated session or validate it against the user's shop assignments. Never trust a browser-provided shopId without authorization checks.

All list, detail, update, delete/deactivate and report endpoints must filter by authorized shop. Cross-shop access attempts must return an appropriate 403 or non-disclosing 404 response.

Hash passwords using a modern password hashing algorithm. Use secure HttpOnly, Secure and SameSite cookies for sessions where supported, rate-limit login attempts, and avoid revealing whether an account exists.

Public routes must return only published public fields. Never return purchase cost, supplier information, profit, private notes, stock movements or internal reports.


## 4. Data Model Requirements

Shop: id, name, slug, contact details, address, invoice settings, tax registration/status settings, timezone, createdAt, updatedAt.

User: id, email/username, passwordHash, active status, createdAt, updatedAt. OwnerShop/ShopMembership associates users with authorized shops if needed.

Product: id (internal ID), shopId, barcode (nullable if permitted), name, slug, brand, model, description, images, purchaseCost/current acquisition cost, defaultSellingPrice, pricingRule, lowStockThreshold, warranty, taxCategory, public visibility/status, createdAt, updatedAt.

Enforce barcode uniqueness within the appropriate scope (typically shopId + barcode for shop-owned inventory); handle nullable barcodes deliberately. Do not assume every manufacturer's barcode is globally unique or that one barcode represents a unique physical unit.

StockMovement: id, shopId, productId, movementType (OPENING, RECEIPT, SALE, RETURN, ADJUSTMENT, DAMAGE), quantityDelta or quantity with direction, unitCost, reference type/id, notes, createdBy, createdAt.

Sale: id, shopId, invoiceNumber, status (DRAFT/COMPLETED/CANCELLED/REFUNDED as applicable), subtotal, discountTotal, taxTotal, totalAmount, paymentStatus, createdBy, createdAt, completedAt.

SaleItem: id, saleId, productId, productNameSnapshot, barcodeSnapshot, quantity, unitSellingPrice, discountAmount, taxCategory/tax rate snapshot as applicable, taxAmount, unitCostSnapshot, lineTotal.

Payment: id, shopId, saleId, method (CASH/UPI/CARD/OTHER), amount, status, reference, createdAt.

Expense: id, shopId, category, amount, date, description, createdBy.

Optional later models: Supplier, Purchase, PurchaseItem, Customer, ProductSerialNumber, AuditLog and Return.


## 5. Product and Barcode Workflows

POST /api/v1/products/scan: accept a scanned barcode and return the matching product in the authorized shop, including stock and permitted billing fields. Return a clear not-found response when unregistered.

POST /api/v1/products: create a product after validating required fields, barcode uniqueness, pricing and tax configuration. Generate the internal product ID server-side.

GET /api/v1/products and GET /api/v1/products/:id: search/filter and retrieve shop-scoped products.

PATCH /api/v1/products/:id: update permitted product fields. Preserve historical sale snapshots.

POST /api/v1/inventory/receive: add stock to an existing product and record a stock movement, quantity and acquisition cost. Do not create duplicate products just because a barcode is scanned for another shipment.

Manufacturer barcodes are identifiers, not guaranteed product metadata. If no trusted catalogue integration exists, the owner must enter missing details manually.

Optional product catalogue enrichment may be added later; never treat external catalogue data as authoritative for this shop's purchase cost, sale price or stock.


## 6. Inventory Requirements

Track stock per shop and product. Shop A and Shop B must have independent stock balances, even for the same product model.

Provide GET /api/v1/inventory, GET /api/v1/inventory/low-stock and GET /api/v1/inventory/movements.

Record every receipt, sale, return, damage and manual adjustment as an auditable movement.

Prevent negative inventory by default. Perform stock validation and deduction atomically during sale completion to avoid concurrent overselling.

Define the current-stock calculation consistently: opening stock plus receipts and returns minus sales, damages and outgoing adjustments, or maintain a transactional cached balance backed by movements.

Use idempotency keys or equivalent protection for critical sale/receive requests to avoid duplicate stock movements on retries.


## 7. Pricing, Discounts and Tax

Default pricing rule for the initial business requirement: when purchase cost is below ₹1,000, default selling price may be purchase cost + ₹100. The rule must be configurable and owner-approved, not hardcoded as an immutable legal or accounting rule.

For other products, support a configured default selling price or configurable markup rule.

Store default price separately from the actual unit selling price recorded on each sale item.

Validate price overrides and discount limits server-side. Log overrides where auditability is required.

Tax must be calculated using the shop's legally applicable tax configuration and product tax category. Do not automatically set GST to zero based only on product price being below ₹1,000.

Store sufficient invoice-level and item-level tax snapshots to reproduce historical bills. Apply currency precision and rounding consistently.

Tax and invoice configuration should be reviewed by the business owner/accountant before production use.


## 8. Sale Completion and Invoice Workflow

POST /api/v1/sales should validate product ownership, quantities, prices, discounts, stock availability and applicable tax.

Within a database transaction: create the sale and sale items; preserve unit cost and product/tax snapshots; deduct stock or create corresponding stock movements; record payment state; assign a unique invoice number; and mark the sale completed only when the defined completion rules are met.

Handle payment failure and retry safely. Do not record a successful payment without evidence from the chosen payment flow. For cash/manual UPI confirmation, make the intended confirmation workflow explicit.

Return the canonical sale ID, invoice number, totals, payment status and updated inventory information.

GET /api/v1/sales and GET /api/v1/sales/:id must enforce shop isolation.

GET /api/v1/sales/:id/invoice returns data for a printable invoice. Generate PDF server-side or from trusted invoice data while keeping the saved transaction as the source of truth.

Cancellation and return endpoints must create auditable reversal movements and financial records; do not hard-delete completed sales.


## 9. Profit/Loss and Dashboard

GET /api/v1/dashboard?from=&to= returns shop-scoped summary metrics such as completed sales, net sales, gross profit, low-stock count and recent sales.

GET /api/v1/reports/profit-loss?from=&to= returns net sales, discounts, returns/refunds where applicable, cost of goods sold, gross profit, recorded operating expenses and net profit.

Gross profit = net sales revenue excluding collected tax where appropriate minus cost of goods sold, using the selected inventory-costing policy and sale-item cost snapshots.

Net profit estimate = gross profit minus recorded operating expenses plus other income if supported. Label it as an estimate if the system does not implement full accounting.

Inventory valuation must use a consistent costing policy (e.g., weighted average or batch/FIFO costing) chosen for the project. Do not recalculate historical profit using the current Product.purchaseCost.

All report queries must enforce shop scope and use consistent date/time boundaries.


## 10. Cloudinary Image Requirements

Use Cloudinary for product image storage; PostgreSQL stores secure identifiers and/or delivery URLs and image metadata.

Prefer backend-generated signed upload parameters or a backend upload endpoint. Never expose Cloudinary API secret in frontend environment variables.

Validate allowed MIME types, file size and upload authorization. Restrict image transformations and folder/public-ID conventions as appropriate.

Associate uploaded images with the authorized shop and product. Prevent users from attaching another shop's private asset to a product.

Support image replacement/removal and cleanup of orphaned Cloudinary assets. Public routes may expose only approved product images.


## 11. Public Catalogue API

GET /api/v1/public/products: return published product records only, with pagination, search and approved filters.

GET /api/v1/public/products/:slug-or-id: return public details and approved images.

Define whether the catalogue is global across both shops or shop-specific. If shop-specific, use a public shop slug or another explicit selection mechanism.

Public response fields may include name, brand, model, description, public images, warranty and configured public price/availability. Exclude purchase cost, internal margins, supplier data and private operational details.

Public product pages should not imply online checkout unless that feature is separately implemented.


## 12. API Error Handling and Validation

Use consistent JSON responses and appropriate HTTP status codes: 400 for invalid input, 401 for unauthenticated access, 403/404 for unauthorized resources, 409 for conflicts such as duplicate barcode or insufficient stock, and 500 for unexpected failures.

Validate request bodies, query parameters and path parameters with a schema-validation library.

Return useful but non-sensitive error messages. Do not leak stack traces, database queries, secrets or other shop's data.

Add pagination and bounded query limits for lists and reports.

Use structured logs with request IDs; never log passwords, session tokens or unnecessary personal data.


## 13. Security and Operational Requirements

Use HTTPS in production, secure session handling, rate limiting, CORS allowlists, security headers and input validation.

Use least-privilege database credentials and keep DATABASE_URL, JWT/session secrets and Cloudinary API secrets in server-side environment variables.

Apply Prisma migrations through a controlled deployment process. Back up PostgreSQL and test restoration.

Add indexes for shopId, barcode, product name/slug, sale date, invoice number and foreign-key lookup paths as appropriate.

Maintain audit logs for price overrides, inventory adjustments, cancellations and sensitive owner actions.

Test concurrent sale attempts, duplicate requests, failed transactions, access-control boundaries and backup restoration.


## 14. Acceptance Criteria

A scanned registered barcode returns the existing shop-scoped product. An unknown barcode can be registered without relying on the barcode to contain all product details.

Receiving additional stock increases the correct shop's inventory and creates an auditable stock movement.

A completed sale atomically creates sale records, records cost snapshots, updates stock and returns an invoice number.

Concurrent sales cannot oversell stock when negative stock is disallowed.

Shop A cannot read or modify Shop B's products, inventory, invoices, payments or reports.

Public catalogue endpoints never expose purchase cost, margins, supplier data or private records.

Cloudinary secrets remain server-side and image uploads are authorized and validated.

Profit/loss reports use historical sale-item costs and consistently handle discounts, returns, applicable tax and recorded expenses.


## 15. Out of Scope for Initial MVP

Online payment gateway, public customer accounts, automated manufacturer product-data lookup, full statutory accounting, GST filing, multi-branch stock transfers, purchase-order automation, loyalty programs, advanced serial-number tracking and offline synchronization.


## 16. Implementation References

Next.js documentation: https://nextjs.org/docs

Express documentation: https://expressjs.com/

Prisma documentation: https://www.prisma.io/docs

PostgreSQL documentation: https://www.postgresql.org/docs/

Cloudinary documentation: https://cloudinary.com/documentation
