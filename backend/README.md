# Electronics Shop Management System — Backend

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
# Edit .env with your DATABASE_URL, JWT_SECRET, Cloudinary credentials

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed database (1 owner, 2 shops, sample products)
npm run prisma:seed
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
# Ensure test database exists and migrations are applied
npm test
```

## Default credentials (after seeding)

- **Email:** `owner@electronics.com`
- **Password:** `owner123`

## API Base URL

`http://localhost:4000/api/v1`

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/login | No | Login |
| GET | /auth/me | Yes | Session info |
| POST | /auth/logout | Yes | Logout |
| GET | /shops/mine | Yes | List user's shops |
| GET | /shops/current | Yes+Shop | Current shop details |
| PATCH | /shops/current | Yes+Shop | Update shop |
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
| POST | /images/signed-upload | Yes+Shop | Cloudinary signed params |
| POST | /images/attach | Yes+Shop | Attach image |
| PUT | /images/:imageId | Yes+Shop | Replace image |
| DELETE | /images/:imageId | Yes+Shop | Remove image |
| GET | /public/shops/:slug/products | No | Public catalogue |
| GET | /public/shops/:slug/products/:id | No | Public product |
