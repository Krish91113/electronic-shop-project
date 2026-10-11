# Volt Electronics - Management System

A complete Electronics Shop Billing, Inventory & Store Branch Management System built for single-owner multi-shop operations.

## Architecture

- **`frontend/`**: Vite + React 19 + TypeScript + Tailwind CSS + TanStack Router + Radix UI + Lucide Icons.
  - Public Storefront & Catalogue (`/`, `/products/:id`)
  - Owner Login (`/login`)
  - Real-Time Store Dashboard (`/dashboard`)
  - Multi-Shop Context Switching (Shop A / Shop B)
  - Product Catalog Management (`/products`, `/products/new`, `/products/:id/edit`)
  - Stock Receiving & Inventory Controls (`/inventory`, `/inventory/receive`)
  - Point of Sale / POS Billing (`/billing`)
  - Searchable Sales History & Print-Ready Invoices (`/sales`, `/sales/:id`)
  - Profit & Loss Overview (`/reports/profit-loss`)
  - Shop Settings & Customization (`/settings`)

- **`backend/`**: Node.js + Express + Prisma ORM + PostgreSQL + Cloudinary.
  - Shop isolation architecture
  - Product & barcode lookups
  - Atomic sale completion & inventory deduction
  - Auditable stock movements & financial reporting

---

## Getting Started

### 1. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Build for production:
```bash
npm run build
```

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Configure your DATABASE_URL in .env
npx prisma generate
npx prisma db push
# Optionally load demo data (destructive — deletes existing rows):
#   PowerShell: $env:ALLOW_DESTRUCTIVE_SEED="true"; npm run prisma:seed
npm run dev
```

The frontend talks to the backend at `VITE_API_BASE_URL` (default `http://localhost:4000`).
Public catalogue slug defaults to `electronics-hub-main` (`VITE_PUBLIC_SHOP_SLUG`).
Owner login (after seeding): `owner@electronics.com` / `owner123`.

---

## License

MIT
