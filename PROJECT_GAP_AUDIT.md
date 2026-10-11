# PROJECT GAP AUDIT — Volt Electronics Management System

**Audit Date:** 2026-10-11  
**Auditor:** Senior Full-Stack Engineer review  
**Scope:** Full repository — frontend, backend, database, tests, configuration, security

---

## SUMMARY

The repository contains a well-structured backend with solid architecture (Express + Prisma + PostgreSQL, JWT cookies, shop isolation, atomic sales transactions, idempotency middleware). The frontend is a **UI prototype only**: every page uses hardcoded `DemoProvider` state, no real API calls exist, authentication is fake ("Explore demo workspace" bypasses login), and all business operations (sales, stock, products) are local React state only.

**Critical finding:** Zero frontend–backend integration exists. The application is not functional beyond visual demonstration.

---

## 1. EXISTING AND WORKING (BACKEND)

### ✅ Backend — Fully Implemented
- `POST /api/v1/auth/login` — JWT cookie auth with bcrypt, timing-safe comparison
- `GET /api/v1/auth/me` — session retrieval
- `POST /api/v1/auth/logout` — cookie clear
- `authenticate` + `resolveShop` middleware — proper shop isolation via `x-shop-id` header
- `GET/POST /api/v1/products` — list with pagination/search/filter, create with slug+inventory
- `POST /api/v1/products/scan` — barcode lookup
- `GET/PATCH /api/v1/products/:id` — get + update with audit log for price override
- `POST /api/v1/inventory/receive` — weighted average cost stock receipt (transactional)
- `POST /api/v1/inventory/adjust` — stock adjustment with audit log
- `GET /api/v1/inventory` — paginated list
- `GET /api/v1/inventory/low-stock` — products at/below threshold
- `GET /api/v1/inventory/movements` — stock movement history
- `POST /api/v1/sales` — full atomic sale: stock lock, deduction, invoice numbering, payments, movements
- `GET /api/v1/sales` — paginated list with date filters
- `GET /api/v1/sales/:id` — sale detail
- `GET /api/v1/sales/:id/invoice` — invoice with shop details
- `POST /api/v1/sales/:id/cancel` — cancel + stock restore
- `POST /api/v1/sales/:id/return` — partial return
- `POST/GET/PATCH/DELETE /api/v1/expenses` — full CRUD
- `GET /api/v1/reports/profit-loss` — P&L using cost snapshots, expenses, refunds
- `GET /api/v1/dashboard` — aggregated metrics, recent sales, low-stock count
- `POST /api/v1/images/upload/:productId` — Cloudinary image upload
- `PATCH /api/v1/images/:imageId/primary` — set primary image
- `DELETE /api/v1/images/:imageId` — delete image + Cloudinary cleanup
- `GET /api/v1/public/shops/:slug/products` — public catalogue (no cost fields)
- `GET /api/v1/public/shops/:slug/products/:productSlug` — public product detail
- Idempotency middleware (`idempotent.js`) — exists but NOT applied to sales route
- Prisma schema — complete, all relationships, proper cascades, indexes
- Seed script — two shops, products, tax categories (but **destroys all data** unconditionally)
- API tests (`tests/api.test.js`) — comprehensive: concurrency, idempotency, cross-shop isolation, auth, CRUD, P&L snapshot correctness

### ✅ Frontend — Working (Visual Only)
- TanStack Router setup with all routes defined and generating correctly
- All shadcn/ui components installed (accordion, alert, badge, button, card, dialog, input, select, table, etc.)
- Tailwind CSS v4 configured
- Responsive CSS layout (sidebar, mobile bottom nav, POS grid, catalogue grid)
- Component library: `AppShell`, `PageHeader`, `MetricCard`, `EmptyState`, `SearchInput`, `StatusBadge`, `Brand`, `Confirm`, `QuantityStepper`, `Field`, `DateRangeControl`
- Public catalogue and product detail UI
- Login page UI (but submits nothing real)
- Dashboard, Products, Inventory, Billing, Sales, Invoice, Reports, Settings UI shells
- Print invoice intent via `window.print()`

---

## 2. MISSING OR INCOMPLETE

### 🔴 CRITICAL — No Integration Exists
| Area | Issue |
|------|-------|
| Auth | Login calls nothing; "Explore demo workspace" link bypasses auth entirely |
| Auth | No protected routes — all admin pages accessible without login |
| Auth | No session persistence — `DemoProvider` resets on page refresh |
| Auth | No shop switcher connected to real user memberships |
| All pages | Every page reads from `useDemo()` (local React state), never from API |
| Billing | Sale submission is fake — no stock deducted, no invoice created |
| Products | CRUD is local state only — no persistence |
| Inventory | Stock receive is local state only — no persistence |

### 🔴 CRITICAL — Missing Backend Endpoints
| Endpoint | Status | Impact |
|----------|--------|--------|
| `PATCH /api/v1/shops/:id` | Missing | Settings page cannot update shop details |
| `GET /api/v1/shops` | Missing | Frontend needs to list user's shops |
| `GET /api/v1/shops/:id/tax-categories` | Missing | Billing and product form need tax options |
| `POST /api/v1/shops/:id/tax-categories` | Missing | Settings cannot create tax categories |
| `PATCH /api/v1/shops/:id/tax-categories/:tcId` | Missing | Settings cannot edit tax rates |

### 🔴 CRITICAL — Security Issues
| Issue | Location |
|-------|----------|
| Idempotency middleware not applied to `POST /api/v1/sales` route | `sales.routes.js` |
| Multer not installed/configured — image upload route will fail at runtime | `images.routes.js` |
| Seed script deletes ALL data unconditionally — unsafe for non-dev environments | `seed.js` |
| No `NODE_ENV` guard in seed script | `seed.js` |
| `CORS_ORIGIN` defaults to `localhost:3000` but Vite dev runs on `5173` | `env.js` |

### 🟡 HIGH — Frontend Missing Features
| Feature | Status |
|---------|--------|
| Central API client | Not created — no `src/lib/api.ts` |
| Auth context/hook | Not created — no `src/lib/auth.tsx` |
| React Query integration | `QueryClient` exists in router but no queries used anywhere |
| `.env` / `VITE_API_BASE_URL` | Not configured in frontend |
| Protected route guard | Not implemented |
| Loading skeletons on data fetch | Not implemented |
| Error boundary / API error toasts | Not implemented |
| Pagination on products/sales/inventory | Not implemented |
| Date range picker (real) | Only a `<select>` placeholder |
| Tax breakdown in billing | Hardcoded "Not calculated · Demo" |
| Invoice print styles | No `@media print` CSS |
| Public catalogue connected to shop slug | Uses demo data |
| Image upload UI connected to backend | Local FileReader only |

### 🟡 HIGH — Backend Issues
| Issue | Location |
|-------|----------|
| `multer` dependency missing from `package.json` | Image uploads will crash |
| `shops` module has no update/list endpoints | `shops.routes.js` / `shops.service.js` |
| `tax-categories` has no CRUD routes | No module exists |
| `GET /api/v1/inventory` route doesn't support `lowStock` filter in query | `inventory.routes.js` |
| `validate` middleware uses `unknown()` on query params — may strip valid fields | `validate.js` |
| `images.routes.js` references multer but no multer config file exists | Runtime error |
| Dashboard `products` count not included in response | `dashboard.service.js` |
| Report does not include `taxCollected` in its breakdown visibility | `reports.service.js` |

### 🟠 MEDIUM — Data & Calculation Issues
| Issue | Detail |
|-------|--------|
| Billing total is calculated client-side in demo | Backend must be authoritative |
| Invoice number displayed before server confirmation | Race condition risk |
| No duplicate checkout prevention in frontend | Double-click can double-submit |
| `SaleItem.taxRateSnapshot` defaults to `0` if product has no tax category | Correct, but no UI indication |
| `StockMovement.referenceId` update uses `updateMany` with potential false matches | Could update wrong movements |
| `applyPricingRule`: `multiplier` branch reached even when cost < threshold if no `addend` | Logic gap |

### 🟠 MEDIUM — UX / Responsive Issues
| Issue |
|-------|
| No empty states on real API pages (skeleton → empty state flow) |
| No loading states during API calls |
| Billing on mobile: cart panel stacks below products — may require scroll |
| No keyboard shortcut for barcode scan focus (e.g., press `/`) |
| Invoice page has no real shop name/address from backend |
| Settings form resets on shop switch (correct) but no feedback |
| No toast on session expiry (silent redirect) |

---

## 3. FRONTEND / BACKEND API MISMATCHES

| Frontend Expectation | Actual Backend | Action Required |
|---------------------|----------------|-----------------|
| `GET /api/v1/shops` (list user's shops) | Not implemented | Add to shops router |
| `PATCH /api/v1/shops/:id` (update shop) | Not implemented | Add to shops router |
| Tax categories per shop | No CRUD routes | Add tax-categories routes |
| Product `category` field | Schema has no `category` — only `brand`, `model`, `name` | Frontend uses demo `category`; backend has none — add to Product schema or map from brand |
| Products list response: `data.products[]` | Backend returns `{ products, pagination }` wrapped in `{ data }` | Match in API client |
| Inventory list: quantity displayed | Backend returns `{ items, pagination }` with inventory + product | Correct in client |
| Sales list: `data.sales[]` | Backend returns `{ sales, pagination }` | Correct |
| Sale creation: `paymentMethod` field | Backend uses `paymentMethod` | Match: frontend must send `paymentMethod` not `payment_method` |
| Public catalogue: `defaultSellingPrice` used as price | Backend exposes `defaultSellingPrice` | Must display correctly |
| Auth cookie: `credentials: 'include'` | Backend sets HttpOnly cookie | Frontend fetch must include credentials |

---

## 4. DATABASE SCHEMA ISSUES

| Issue | Detail |
|-------|--------|
| `Product` has no `category` field | Frontend code uses `category` but it's not in schema; use `brand`/`model` or add field |
| `Shop` has no `logoUrl`, `invoiceFooter` fields | Settings page shows these; not in schema |
| `Inventory` has no `openingQty` field | Minor: tracked via `StockMovement.OPENING` |
| `Sale.status` values not enumerated | String column; rely on service-layer constraints |

**Recommended addition to schema:**
```prisma
// In Product model — add:
category  String?

// In Shop model — add:
logoUrl       String?
invoiceFooter String?
```

---

## 5. AUTHENTICATION & SHOP ISOLATION ASSESSMENT

### ✅ Correct
- JWT stored in HttpOnly cookie, not localStorage
- `resolveShop` validates user membership before every shop-scoped request
- Returns 404 (not 403) on cross-shop access to avoid ID enumeration
- bcrypt with timing-safe comparison
- 7-day token expiry

### ❌ Issues
- Frontend has zero auth — any URL is accessible
- No token refresh mechanism (7-day expiry is long enough for basic use)
- `COOKIE_SECRET` env var: missing from `.env.example` description
- `sameSite: 'lax'` is correct for dev; production needs HTTPS (`secure: true` is already conditional)

---

## 6. INVENTORY & BILLING CORRECTNESS

### ✅ Correct
- `FOR UPDATE` row locks on inventory during sale prevents overselling
- Weighted average cost on stock receipt
- Cost snapshot on sale items (historical accuracy)
- Atomic transaction with rollback

### ❌ Issues  
- Idempotency key NOT wired to sales route — duplicate submissions possible
- `StockMovement.referenceId` update logic: `updateMany` filter could match multiple movements if two concurrent transactions run (low probability but fixable)
- No maximum discount validation on backend (discount could exceed line total)
- `unitSellingPrice` sent from frontend not validated against a minimum floor

---

## 7. BUILD & CONFIGURATION ISSUES

| Issue | Impact |
|-------|--------|
| Vite has no `server.proxy` for API — dev requests to `/api/v1` will 404 | Critical for development |
| No `VITE_API_BASE_URL` or `.env` file in frontend | Frontend cannot call backend |
| `@tanstack/react-start` in dependencies but unused — potentially conflicts with `@tanstack/react-router` | Build warning/error |
| `multer` missing from backend dependencies | Image upload crashes at startup |
| TanStack Router plugin not in `vite.config.ts` — route generation uses `.tanstack/tmp` but plugin not configured | Route tree may not auto-regenerate |
| `vitest` version mismatch: backend uses `^2.x`, frontend uses `^4.x` | Tests may behave differently |

---

## 8. PRIORITIZED IMPLEMENTATION CHECKLIST

### 🔴 CRITICAL (must fix first)
- [ ] Add `VITE_API_BASE_URL` to frontend `.env` and configure Vite proxy
- [ ] Create `src/lib/api.ts` — typed API client with credentials, error handling
- [ ] Create `src/lib/auth.tsx` — AuthContext, useAuth hook, login/logout/session
- [ ] Update `__root.tsx` — wrap with AuthProvider, implement protected route guard
- [ ] Connect Login page to `POST /api/v1/auth/login`
- [ ] Apply idempotency middleware to `POST /api/v1/sales` route
- [ ] Add `multer` to backend dependencies and configure image middleware
- [ ] Add `PATCH /api/v1/shops/:id` and `GET /api/v1/shops` endpoints
- [ ] Add tax categories CRUD endpoints
- [ ] Add `NODE_ENV` guard to seed script

### 🟡 HIGH (connect all pages)
- [ ] Dashboard → `GET /api/v1/dashboard`
- [ ] Products → `GET /api/v1/products`, `PATCH /:id` (deactivate), `DELETE`
- [ ] ProductForm → `POST /api/v1/products`, `PATCH /api/v1/products/:id`
- [ ] Inventory → `GET /api/v1/inventory`, `GET /api/v1/inventory/low-stock`, `GET /api/v1/inventory/movements`
- [ ] ReceiveStock → `POST /api/v1/products/scan`, `POST /api/v1/inventory/receive`
- [ ] Billing → `GET /api/v1/products` + `POST /api/v1/products/scan` + `POST /api/v1/sales`
- [ ] Sales → `GET /api/v1/sales` with pagination + date filter
- [ ] Invoice → `GET /api/v1/sales/:id/invoice`
- [ ] Reports → `GET /api/v1/reports/profit-loss`, `GET/POST/PATCH/DELETE /api/v1/expenses`
- [ ] Settings → `GET/PATCH /api/v1/shops/:id`, tax categories CRUD
- [ ] Public Catalogue → `GET /api/v1/public/shops/:slug/products`

### 🟠 MEDIUM (quality & UX)
- [ ] Add `category` field to Product schema + migration
- [ ] Add `logoUrl`, `invoiceFooter` to Shop schema + migration
- [ ] Loading skeletons on all data-fetching pages
- [ ] Empty states with actionable CTAs
- [ ] API error normalization + toast display
- [ ] Duplicate checkout prevention (disabled state during submission)
- [ ] Tax breakdown display in billing
- [ ] `@media print` styles for invoice
- [ ] Image upload UI connected to backend

---

## 9. FILES TO CREATE/MODIFY

### New Files
- `frontend/src/lib/api.ts`
- `frontend/src/lib/auth.tsx`
- `frontend/.env`
- `frontend/.env.example`
- `backend/src/modules/shops/tax-categories.routes.js`
- `backend/src/modules/shops/tax-categories.controller.js`
- `backend/src/modules/shops/tax-categories.service.js`

### Modified Files
- `frontend/src/routes/__root.tsx` — AuthProvider + protected guard
- `frontend/src/routes/login.tsx` — real login
- `frontend/src/routes/dashboard.tsx` — real data
- `frontend/src/routes/products.tsx` — real CRUD
- `frontend/src/routes/products.new.tsx` — real form
- `frontend/src/routes/products.$id.edit.tsx` — real form
- `frontend/src/routes/inventory.tsx` — real data
- `frontend/src/routes/inventory.receive.tsx` — real scan+receive
- `frontend/src/routes/billing.tsx` — real POS
- `frontend/src/routes/sales.tsx` — real list
- `frontend/src/routes/sales.$id.tsx` — real invoice
- `frontend/src/routes/reports.profit-loss.tsx` — real P&L + expenses
- `frontend/src/routes/settings.tsx` — real shop settings
- `frontend/src/routes/index.tsx` — real public catalogue
- `frontend/src/routes/products.$id.tsx` — real public detail
- `frontend/src/components/shop/admin.tsx` — integrate API hooks
- `frontend/src/components/shop/billing.tsx` — integrate API hooks
- `frontend/src/components/shop/public.tsx` — integrate API hooks
- `frontend/src/components/shop/shared.tsx` — add skeleton/loading components
- `frontend/src/components/shop/data.tsx` — remove demo data from prod paths
- `frontend/vite.config.ts` — add proxy, env
- `backend/src/modules/shops/shops.routes.js` — add update + tax categories routes
- `backend/src/modules/shops/shops.service.js` — add update + list service
- `backend/src/modules/sales/sales.routes.js` — apply idempotency middleware
- `backend/src/modules/images/images.routes.js` — fix multer config
- `backend/package.json` — add multer
- `backend/prisma/schema.prisma` — add category to Product, logoUrl/invoiceFooter to Shop
- `backend/prisma/seed.js` — add NODE_ENV guard
- `backend/.env.example` — complete all variables

---

## 10. RESOLUTION STATUS (post-integration)

**Status date:** 2026-10-11 (integration pass)
**Verification performed:**
- `frontend`: `npx tsc --noEmit` → pass; `npm run build` → pass; `npm run lint` → 0 errors (7 pre-existing fast-refresh warnings); `npm test` → pass.
- `backend`: `npx prisma validate` + `generate` + `db push` → pass; `npm test` → 22/22 pass.

### ✅ Completed in this pass
- **Frontend API client** (`src/lib/api.ts`): real response-envelope handling (`{ data, pagination }`), pagination-aware list helpers, credentials include, 30s timeout + network error mapping, `Idempotency-Key` header on sale create, global 401 handler hook.
- **Auth** (`src/lib/auth.tsx`): registered 401 handler clears session; query cache cleared on login/logout/shop switch; shop derived from real memberships; sessionStorage shop preference.
- **Protected routes** (`routes/__root.tsx`): `AuthProvider` + redirect-to-login guard for admin prefixes.
- **Pages wired to API**: Dashboard, Products, Product Form, Inventory, Receive Stock, Billing, Sales, Invoice, Reports (P&L), Settings, Public Catalogue, Public Product Detail.
- **Legacy demo removed**: all `useDemo`/`DemoProvider`/sample-data components deleted; `data.tsx` now only holds presentational helpers; public catalogue uses real `inStock` (no fabricated quantities); no purchase-cost data rendered publicly.
- **Backend fixes**:
  - `multer` added (v2.x) + `config/multer.js`; server-side upload kept authoritative (secrets stay server-side).
  - `POST /images/upload/:productId` and `PATCH /images/:imageId/primary` implemented; `attach` restricted to the shop's Cloudinary folder.
  - `shops.controller.getOne/update` now enforce membership (`getShopForUser`/`updateShopForUser`) — closes cross-shop IDOR.
  - `Product.category` handled in create/update schemas, service and public select.
  - `paymentMethod` accepted case-insensitively (title-case from POS maps to stored enum).
  - Idempotency middleware now hashes the request body and rejects key reuse with a different payload; only successful responses are cached.
  - Multer errors normalized to HTTP 400.
  - Seed script refuses to run in production and requires `ALLOW_DESTRUCTIVE_SEED=true` outside tests.

### ⚠️ Known limitations / follow-ups
- Reports screen surfaces the P&L breakdown; expense CRUD UI is not yet exposed (API client methods exist).
- Date-range controls on Dashboard use the backend default period; Reports offers a preset range (Today/This week/This month/Last month).
- Cloudinary uploads require valid credentials in `backend/.env`; uploads will error without them.
- Local dev database required `prisma db push` to add `Shop.invoiceFooter` (schema-first project; no migrations folder).
- Repo-wide prettier formatting was applied via the project's `npm run format` script to make `npm run lint` pass (all source previously used single quotes against a double-quote config).
