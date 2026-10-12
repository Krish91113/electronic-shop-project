# Time Centre Mobile & Electronics - Management System

A complete Electronics Shop Billing, Inventory & Store Branch Management System built for Time Centre Mobile & Electronics multi-shop operations.

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
# Configure DATABASE_URL (pooled) and DIRECT_URL (direct) in .env
npm run prisma:generate
npm run prisma:migrate:deploy

# Safe idempotent initialization (creates owners & initial shops without deleting data):
npm run prisma:init:prod

# Optional development demo seed (destructive — clears tables and loads sample inventory):
#   PowerShell: $env:ALLOW_DESTRUCTIVE_SEED="true"; npm run prisma:seed
#   Bash:       ALLOW_DESTRUCTIVE_SEED=true npm run prisma:seed

npm run dev
```

### Store Branches & Isolated Credentials

| Branch / Role | Location / Address | Contact | Owner Email | Default Password |
|---|---|---|---|---|
| **Shop 1** | Main road Bishnugarh Near by Axis Bank Bishnugarh | `7004114744` | `owner@electronics.com` | `Owner@12345` |
| **Shop 2** | Akhara Chowck Bishnugarh | `7004114744` | `owner2@electronics.com` | `Owner@12345` |
| **Super Owner** | Multi-Shop Consolidated Access | `7004114744` | `superowner@electronics.com` | `Owner@12345` |

The public catalogue routes dynamically display both branches at `/`, `/shop/time-centre-shop-1`, and `/shop/time-centre-shop-2` with live WhatsApp/Call buttons.

---

## Production Deployment Guide

### Deploying the Frontend (e.g. Vercel)
1. Set Root Directory to `frontend`.
2. Framework Preset: **Vite**.
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. Environment Variables:
   - `VITE_API_BASE_URL`: URL of your deployed backend (e.g. `https://your-api.onrender.com`).
   - `VITE_STORE_NAME`: `Time Centre Mobile & Electronics`.
   - `VITE_STORE_PHONE`: `7004114744`.
   - `VITE_STORE_WHATSAPP`: `917004114744`.

### Deploying the Backend (e.g. Render / Railway / VPS)
1. Set Root Directory to `backend`.
2. Build Command: `npm install && npm run prisma:generate && npm run prisma:migrate:deploy`.
3. Start Command: `npm start`.
4. Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `4000` (or platform default)
   - `DATABASE_URL`: Your pooled PostgreSQL connection string (Neon pooler).
   - `DIRECT_URL`: Your direct PostgreSQL connection string (Neon direct).
   - `JWT_SECRET`: Random 32+ character secret string.
   - `COOKIE_SECRET`: Random 32+ character secret string.
   - `CORS_ORIGIN`: Your frontend URL (e.g. `https://your-frontend.vercel.app`).
   - Cloudinary variables for image uploads: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

For complete migration, backup, and architecture details, see [DATABASE_MIGRATION_GUIDE.md](file:///c:/Users/HP/Desktop/electronic-shopping-project/DATABASE_MIGRATION_GUIDE.md).

---

## License

MIT
