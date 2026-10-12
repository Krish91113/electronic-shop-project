# Time Centre Mobile & Electronics Management System — Backend

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Cloudinary account (for image uploads)

## Setup

```bash
# Install dependencies
npm install

# Copy env and configure
cp .env.example .env
# Edit .env with your DATABASE_URL (pooled), DIRECT_URL (direct), JWT_SECRET, Cloudinary credentials

# Generate Prisma client
npm run prisma:generate

# Deploy migrations to database
npm run prisma:migrate:deploy

# Verify migration state
npm run prisma:migrate:status

# Safe, Idempotent Database Initialization (Creates independent owners & 2 shops without deleting data)
npm run prisma:init:prod

# (Optional DEV only) Seed demo catalog data (destructive — deletes ALL existing data):
#   PowerShell:  $env:ALLOW_DESTRUCTIVE_SEED="true"; npm run prisma:seed
#   Bash:        ALLOW_DESTRUCTIVE_SEED=true npm run prisma:seed
```

## Run

```bash
# Development (with file watching)
npm run dev

# Production
npm start
```

## Test

```bash
# Verify complete database integration workflow (create product, stock, sale, persistence)
node prisma/verify-integration.js

# Automated test suite (requires dedicated test database and ALLOW_DESTRUCTIVE_TESTS=true)
$env:ALLOW_DESTRUCTIVE_TESTS="true"; npm test
```

## Default credentials (after init)

- **Shop 1 Owner:** `owner1@timecentre.com` (dedicated to Shop 1 only)
- **Shop 2 Owner:** `owner2@timecentre.com` (dedicated to Shop 2 only)
- **Super Owner:** `superowner@timecentre.com` (business owner with access to both shops)

## API Base URL

`http://localhost:4000/api/v1`

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/login | No | Login |
| GET | /auth/me | Yes | Session info |
| POST | /auth/logout | Yes | Logout |
| GET | /shops | Yes | List user's shops |
| GET | /shops/mine | Yes | List user's shops (alias) |
| GET | /shops/current | Yes+Shop | Current shop details |
| PATCH | /shops/current | Yes+Shop | Update current shop |
| GET | /shops/:id | Yes | Get shop (must be a member) |
| PATCH | /shops/:id | Yes | Update shop (must be a member) |
| POST | /products | Yes+Shop | Create product |
| GET | /products | Yes+Shop | List products |
| GET | /products/:id | Yes+Shop | Get product |
| PATCH | /products/:id | Yes+Shop | Update product |
| POST | /products/scan | Yes+Shop | Scan barcode |
| POST | /inventory/receive | Yes+Shop | Receive stock |
| POST | /inventory/adjust | Yes+Shop | Adjust stock |
| GET | /inventory | Yes+Shop | List inventory |
| GET | /inventory/low-stock | Yes+Shop | Low stock items |
| GET | /inventory/movements | Yes+Shop | Stock movements |
| POST | /sales | Yes+Shop | Create sale |
| GET | /sales | Yes+Shop | List sales |
| GET | /sales/:id | Yes+Shop | Get sale |
| GET | /sales/:id/invoice | Yes+Shop | Invoice data |
| POST | /sales/:id/cancel | Yes+Shop | Cancel sale |
| POST | /sales/:id/return | Yes+Shop | Return items |
| POST | /payments | Yes+Shop | Record payment |
| GET | /payments | Yes+Shop | List payments |
| GET | /payments/:id | Yes+Shop | Get payment |
| POST | /expenses | Yes+Shop | Create expense |
| GET | /expenses | Yes+Shop | List expenses |
| GET | /expenses/:id | Yes+Shop | Get expense |
| PATCH | /expenses/:id | Yes+Shop | Update expense |
| DELETE | /expenses/:id | Yes+Shop | Delete expense |
| GET | /reports/profit-loss | Yes+Shop | P&L report |
| GET | /dashboard | Yes+Shop | Dashboard metrics |
| POST | /images/upload/:productId | Yes+Shop | Upload image (server-side, multer → Cloudinary) |
| POST | /images/signed-upload | Yes+Shop | Cloudinary signed params (optional direct flow) |
| POST | /images/attach | Yes+Shop | Attach an uploaded image to a product |
| PATCH | /images/:imageId/primary | Yes+Shop | Set product's primary image |
| PUT | /images/:imageId | Yes+Shop | Replace image |
| DELETE | /images/:imageId | Yes+Shop | Remove image |
| GET | /public/shops/:slug/products | No | Public catalogue |
| GET | /public/shops/:slug/products/:id | No | Public product |
