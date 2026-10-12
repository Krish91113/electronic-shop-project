# Time Centre Mobile & Electronics - Management System

A complete, responsive Electronics Shop Billing & Inventory Management System for Time Centre Mobile & Electronics.

## Features

- **Public Catalogue (`/`, `/products/:id`)**: Showcase published products with live search, categories, and full product details.
- **Shop Switcher**: Operate multiple shops (Shop A / Shop B) with isolated data contexts.
- **Dashboard (`/dashboard`)**: KPI metrics, sales chart, low-stock warnings, and recent transaction overview.
- **Product Management (`/products`, `/products/new`, `/products/:id/edit`)**: Add, edit, deactivate products, manufacturer barcode support, pricing & tax rules.
- **Inventory & Stock Receiving (`/inventory`, `/inventory/receive`)**: Track stock levels, receive stock against barcodes.
- **Billing / POS (`/billing`)**: Fast item search/scan, cart with custom pricing & discounts, tax calculation, and instant checkout.
- **Sales History & Invoicing (`/sales`, `/sales/:id`)**: Browse invoices and print/download receipts with browser print layout.
- **Profit & Loss (`/reports/profit-loss`)**: Track net sales, COGS, gross & net margins.
- **Settings (`/settings`)**: Shop configuration, invoice styling, and thresholds.

## Getting Started

### Prerequisites

Node.js (>= 20) and npm.

### Installation

```sh
npm install
```

### Development

```sh
npm run dev
```

### Build

```sh
npm run build
```

### Test

```sh
npm run test
```
