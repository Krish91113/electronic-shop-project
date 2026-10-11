# Frontend Functional Requirements Document (FRD)

**Electronics Shop Management System**  
**Version:** 1.0 | **Date:** October 2026

## 1. Purpose and Scope

This document defines the frontend requirements for a responsive web application used by a single owner operating two shops. The application includes a public product catalogue and an authenticated owner portal.

The frontend must work well on desktop, tablet, and mobile. It must consume the backend REST API and must not independently determine authoritative stock, invoice totals, tax, or profit.

## 2. Users and Access

Public customer: Can browse published products and view public product details. No login is required.

Shop owner: Signs in through /login and accesses only the shop data authorized by the backend. The owner can manage products, inventory, sales, invoices, and reports for the selected/assigned shop.

Shop isolation: Shop A and Shop B have separate credentials or owner-to-shop assignments and separate dashboards/data. The UI must never allow one shop's data to appear in another shop's authenticated workspace.

## 3. Technology and Integration

Framework: Next.js with TypeScript.

Styling: Tailwind CSS or the project's agreed responsive UI system.

API: REST calls to the Node.js/Express backend over HTTPS. Use a central API client with consistent error handling and environment-based API base URL.

Forms: Client-side validation for usability, with server-side validation treated as authoritative.

Images: Product images are uploaded through a secure backend-issued Cloudinary upload flow or the backend upload endpoint. Store and display the resulting Cloudinary URL returned by the backend.

Barcode scanning: Support a USB/Bluetooth scanner that types the scanned code into a focused input, plus optional camera scanning where browser/device support and permissions allow. Always provide manual barcode entry and product search as fallback.

## 4. Route and Page Requirements

/ — Public catalogue. Show only products explicitly published for public viewing. Provide search, category/brand filters if available, product cards, image, name, brand/model, and public price/availability according to business policy.

/products/[slug-or-id] — Public product detail page. Show public product description, product images, brand/model, warranty and public selling price if configured. Never expose purchase cost, profit, internal notes, supplier data, stock movement history, or private shop data.

/login — Owner login form with username/email and password, loading state, validation, and generic authentication error messages.

/dashboard — Authenticated overview for the authorized shop: sales summary, low-stock items, recent sales, inventory summary and profit metrics returned by the backend.

/products — Product list/search/filter with add/edit/deactivate actions subject to backend permissions.

/products/new and /products/[id]/edit — Product registration/edit forms. Include barcode, name, brand, model, description, images, purchase cost, default selling price/pricing rule, low-stock threshold, warranty, tax category, and public visibility. Internal cost fields are only shown in authenticated owner views.

/inventory — Current stock, low-stock alerts, stock movement history and receive-stock workflow.

/inventory/receive — Scan/search product, enter quantity received, unit acquisition cost, optional supplier/reference and submit stock receipt.

/billing — Point-of-sale screen. Scan/search products, add/remove cart items, edit quantity, apply permitted negotiated price/discount, show tax breakdown returned/calculated by the backend, select payment method, review and finalize sale.

/sales — Searchable sales history with date filters and invoice access.

/sales/[id] — Sale details, payment status, items and printable invoice view.

/reports/profit-loss — Date-range report with net sales, cost of goods sold, gross profit, expenses and net profit where supported.

/settings — Shop profile, invoice details, low-stock defaults and other permitted shop settings.

## 5. Responsive UX Requirements

Use a mobile-first layout. Desktop may use a sidebar and multi-column dashboard; mobile should use a compact navigation menu and stacked cards/forms.

Billing must remain usable on small screens: scanner/search input at the top, cart items in a readable list, totals and primary action visible without horizontal scrolling.

Tables must adapt to narrow screens using responsive cards, column prioritization, or horizontal scrolling only where necessary.

Buttons and form controls must have touch-friendly hit areas. Do not rely on hover-only interactions.

Show loading, empty, success, validation, network-error, unauthorized, and server-error states on all data-driven pages.

Use accessible labels, keyboard navigation, visible focus indicators, meaningful alt text for product images, and sufficient contrast.

## 6. Product Registration and Barcode UX

When a barcode is scanned in Receive Stock or Product Registration, call the backend barcode lookup endpoint.

If the barcode is already registered for the same shop, show the existing product and offer Receive Stock rather than creating a duplicate product.

If the barcode is unknown, open the new-product form with the scanned barcode prefilled. Do not assume the barcode itself contains product name, purchase cost, price or stock.

After successful product registration, show the internal product ID generated by the backend. The system does not need to generate a replacement barcode when a usable manufacturer barcode already exists.

If the same product SKU is received in a later shipment, increase stock for the existing product. Individual serial tracking is a separate optional feature.

## 7. Billing UX and Pricing

Show default selling price and allow an owner-authorized negotiated selling price or discount. The backend must enforce permissions and any minimum-price/discount policy.

Clearly show quantity, unit price, line total, discount, applicable tax, and final payable total. Tax behavior must come from backend shop/product configuration; do not assume GST is zero because the price is below ₹1,000.

Before finalizing, show a confirmation/review state. Disable duplicate submissions while the request is processing.

After successful sale completion, display the invoice number and provide print/download options. Do not show success until the backend confirms the sale.

Handle insufficient stock, invalid price, failed payment, duplicate submission and network errors without silently clearing the cart.

## 8. Dashboard and Reports

Dashboard metrics must be sourced from backend responses and respect the selected date range and shop context.

Distinguish sales revenue from gross profit and net profit. Display metric definitions or help text.

Low-stock warnings use backend inventory values and configured thresholds.

Profit/loss report should offer date filters and display sales revenue, discounts/returns as applicable, cost of goods sold, gross profit, recorded operating expenses and net profit.

Do not calculate authoritative profit using the current product purchase cost in the browser; use saved sale-item cost snapshots/costing data returned by the backend.

## 9. Cloudinary Image Handling

Allow common image formats approved by the backend, with a visible preview and upload progress.

Validate file size/type on the client for usability and again on the server. Never expose Cloudinary API secrets in browser code.

Support replacing/removing an image where authorized. Display a fallback image when an image URL is missing or fails.

Only public product images should be exposed on public routes. Avoid uploading invoices, credentials or private business documents as public assets.

## 10. Frontend Security

Keep authentication credentials and session handling aligned with backend design; prefer secure, HttpOnly cookies for session tokens where supported.

Protect private routes in the UI for usability, but rely on backend authorization for actual security.

Do not trust shop IDs, product prices, tax amounts, stock counts or role claims supplied by the browser.

Do not put database credentials, JWT secrets, or Cloudinary API secrets in NEXT_PUBLIC environment variables.

Clear sensitive shop data from client state on logout or shop-context change.

## 11. Acceptance Criteria

Public users can browse only published public product data and cannot access owner pages or private cost/profit fields.

Owner login leads to the correct authorized shop dashboard. Requests for another shop's data are denied by the backend.

All key pages work at mobile, tablet and desktop widths without critical horizontal overflow.

Scanning a registered barcode retrieves the existing product; scanning an unknown barcode offers registration with the code prefilled.

Receiving additional stock updates the visible inventory after backend confirmation.

Billing displays the backend-confirmed totals and invoice number; successful sales refresh inventory and relevant reports.

Loading, empty, error, and permission-denied states are implemented for all major workflows.

Product images upload securely to Cloudinary and display correctly on public product pages when published.

## 12. Out of Scope for Initial MVP

Customer accounts, online checkout/payment gateway, loyalty points, multi-branch transfers, supplier purchase orders, advanced accounting integrations, automatic manufacturer catalogue enrichment, and individual serial-number tracking unless separately approved.
