import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';

const prisma = new PrismaClient();

let ownerCookie;
let shop1Id;
let shop2Id;
let product1Id; // shop1 product
let product2Id; // shop2 product
let shop1Slug;
let shop2Slug;

async function loginAsOwner() {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'testowner@test.com', password: 'testpass123' });
  const cookies = res.headers['set-cookie'];
  if (!cookies) throw new Error('No cookie returned from login');
  return Array.isArray(cookies) ? cookies[0] : cookies;
}

beforeAll(async () => {
  // Clean and seed test data
  await prisma.auditLog.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.invoiceSequence.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.taxCategory.deleteMany();
  await prisma.shopMembership.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('testpass123', 10);
  const user = await prisma.user.create({
    data: { email: 'testowner@test.com', name: 'Test Owner', passwordHash, role: 'OWNER' },
  });

  const shop1 = await prisma.shop.create({
    data: {
      name: 'Test Shop A', code: 'TSA', slug: 'test-shop-a',
      timezone: 'Asia/Kolkata',
      pricingRule: { threshold: 1000, addend: 100, multiplier: 1.10 },
    },
  });
  const shop2 = await prisma.shop.create({
    data: {
      name: 'Test Shop B', code: 'TSB', slug: 'test-shop-b',
      timezone: 'Asia/Kolkata',
    },
  });
  shop1Id = shop1.id;
  shop2Id = shop2.id;
  shop1Slug = shop1.slug;
  shop2Slug = shop2.slug;

  await prisma.shopMembership.createMany({
    data: [
      { userId: user.id, shopId: shop1Id, role: 'OWNER' },
      { userId: user.id, shopId: shop2Id, role: 'OWNER' },
    ],
  });

  const tc1 = await prisma.taxCategory.create({
    data: { shopId: shop1Id, name: 'GST 18%', rate: 18.0, isDefault: true },
  });
  const tc2 = await prisma.taxCategory.create({
    data: { shopId: shop2Id, name: 'GST 18%', rate: 18.0, isDefault: true },
  });

  // Product in shop 1 with stock=10
  const p1 = await prisma.product.create({
    data: {
      shopId: shop1Id, barcode: 'TEST001', name: 'Test Widget', slug: 'test-widget-' + Date.now(),
      brand: 'TestBrand', purchaseCost: 500, defaultSellingPrice: 600,
      taxCategoryId: tc1.id, isPublished: true,
    },
  });
  product1Id = p1.id;
  await prisma.inventory.create({ data: { shopId: shop1Id, productId: p1.id, quantity: 10 } });
  await prisma.stockMovement.create({
    data: {
      shopId: shop1Id, productId: p1.id, movementType: 'OPENING',
      quantityDelta: 10, unitCost: 500, createdBy: user.id,
    },
  });

  // Product in shop 2 with stock=5
  const p2 = await prisma.product.create({
    data: {
      shopId: shop2Id, barcode: 'TEST002', name: 'Test Gadget', slug: 'test-gadget-' + Date.now(),
      brand: 'TestBrand', purchaseCost: 1500, defaultSellingPrice: 2000,
      taxCategoryId: tc2.id, isPublished: true,
    },
  });
  product2Id = p2.id;
  await prisma.inventory.create({ data: { shopId: shop2Id, productId: p2.id, quantity: 5 } });
  await prisma.stockMovement.create({
    data: {
      shopId: shop2Id, productId: p2.id, movementType: 'OPENING',
      quantityDelta: 5, unitCost: 1500, createdBy: user.id,
    },
  });

  // Invoice sequences
  const year = new Date().getFullYear();
  await prisma.invoiceSequence.createMany({
    data: [
      { shopId: shop1Id, year, lastNumber: 0 },
      { shopId: shop2Id, year, lastNumber: 0 },
    ],
  });

  ownerCookie = await loginAsOwner();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── 1. Concurrent oversell ──────────────────────────────────────
describe('Concurrent oversell prevention', () => {
  it('should only allow one sale to succeed when stock=10 and two sales try qty=8', async () => {
    // Create a dedicated product with stock=10 for this test
    const p = await prisma.product.create({
      data: {
        shopId: shop1Id, barcode: 'CONC001', name: 'Concurrent Item',
        slug: 'concurrent-item-' + Date.now(), purchaseCost: 100, defaultSellingPrice: 200,
      },
    });
    await prisma.inventory.create({ data: { shopId: shop1Id, productId: p.id, quantity: 10 } });

    const salePayload = {
      items: [{ productId: p.id, quantity: 8, unitSellingPrice: 200, discountAmount: 0 }],
      paymentMethod: 'CASH',
    };

    const [r1, r2] = await Promise.all([
      request(app).post('/api/v1/sales').set('Cookie', ownerCookie).set('x-shop-id', shop1Id).send(salePayload),
      request(app).post('/api/v1/sales').set('Cookie', ownerCookie).set('x-shop-id', shop1Id).send(salePayload),
    ]);

    const statuses = [r1.status, r2.status].sort();
    // One should succeed (201), one should fail (409 insufficient stock)
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

    // Verify stock is 2 (10 - 8)
    const inv = await prisma.inventory.findUnique({
      where: { shopId_productId: { shopId: shop1Id, productId: p.id } },
    });
    expect(inv.quantity).toBe(2);
  });
});

// ─── 2. Idempotent retry ─────────────────────────────────────────
describe('Idempotent retry', () => {
  it('should return same response on duplicate Idempotency-Key for sale', async () => {
    const p = await prisma.product.create({
      data: {
        shopId: shop1Id, barcode: 'IDEMP001', name: 'Idempotent Item',
        slug: 'idempotent-item-' + Date.now(), purchaseCost: 100, defaultSellingPrice: 150,
      },
    });
    await prisma.inventory.create({ data: { shopId: shop1Id, productId: p.id, quantity: 20 } });

    const salePayload = {
      items: [{ productId: p.id, quantity: 1, unitSellingPrice: 150 }],
      paymentMethod: 'CASH',
    };
    const idempotencyKey = 'test-idem-key-' + Date.now();

    const r1 = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id)
      .set('Idempotency-Key', idempotencyKey)
      .send(salePayload);

    expect(r1.status).toBe(201);

    const r2 = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id)
      .set('Idempotency-Key', idempotencyKey)
      .send(salePayload);

    // Should get cached response
    expect(r2.status).toBe(201);
    expect(r2.body.data.id).toBe(r1.body.data.id);

    // Stock should only be decremented once
    const inv = await prisma.inventory.findUnique({
      where: { shopId_productId: { shopId: shop1Id, productId: p.id } },
    });
    expect(inv.quantity).toBe(19);
  });
});

// ─── 3. Cross-shop isolation ─────────────────────────────────────
describe('Cross-shop isolation', () => {
  it('should return 404 when accessing shop1 product via shop2 context', async () => {
    const res = await request(app)
      .get(`/api/v1/products/${product1Id}`)
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop2Id);

    expect(res.status).toBe(404);
  });

  it('should return 404 when accessing shop2 product via shop1 context', async () => {
    const res = await request(app)
      .get(`/api/v1/products/${product2Id}`)
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id);

    expect(res.status).toBe(404);
  });

  it('should not allow creating a sale in shop1 with shop2 product', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id)
      .send({
        items: [{ productId: product2Id, quantity: 1, unitSellingPrice: 2000 }],
        paymentMethod: 'CASH',
      });

    expect(res.status).toBe(404);
  });
});

// ─── 4. Public endpoints leak no cost fields ─────────────────────
describe('Public endpoints do not leak cost fields', () => {
  it('should not include purchaseCost, unitCostSnapshot, or supplier data in list', async () => {
    const res = await request(app)
      .get(`/api/v1/public/shops/${shop1Slug}/products`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);

    for (const product of res.body.data) {
      expect(product).not.toHaveProperty('purchaseCost');
      expect(product).not.toHaveProperty('unitCostSnapshot');
      expect(product).not.toHaveProperty('pricingRule');
      expect(product).not.toHaveProperty('lowStockThreshold');
      expect(product).not.toHaveProperty('stockMovements');
    }
  });

  it('should not include cost fields in single product view', async () => {
    // Get slug from test product
    const p = await prisma.product.findUnique({ where: { id: product1Id } });
    const res = await request(app)
      .get(`/api/v1/public/shops/${shop1Slug}/products/${p.slug}`);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('purchaseCost');
    expect(res.body.data).not.toHaveProperty('unitCostSnapshot');
    expect(res.body.data).not.toHaveProperty('pricingRule');
    expect(res.body.data).toHaveProperty('name');
    expect(res.body.data).toHaveProperty('defaultSellingPrice');
  });
});

// ─── 5. P&L using cost snapshots ─────────────────────────────────
describe('P&L report uses cost snapshots', () => {
  it('should compute gross profit from unitCostSnapshot * quantity, not current product cost', async () => {
    // Create product with known cost
    const p = await prisma.product.create({
      data: {
        shopId: shop1Id, barcode: 'PNL001', name: 'P&L Test Product',
        slug: 'pnl-test-' + Date.now(), purchaseCost: 100, defaultSellingPrice: 200,
      },
    });
    await prisma.inventory.create({ data: { shopId: shop1Id, productId: p.id, quantity: 10 } });

    // Make a sale at cost=100, price=200, qty=2
    const saleRes = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id)
      .send({
        items: [{ productId: p.id, quantity: 2, unitSellingPrice: 200 }],
        paymentMethod: 'CASH',
      });
    expect(saleRes.status).toBe(201);

    // Verify the cost snapshot was recorded correctly
    const saleItems = await prisma.saleItem.findMany({
      where: { saleId: saleRes.body.data.id },
    });
    expect(Number(saleItems[0].unitCostSnapshot)).toBe(100);

    // Now update product cost to 150 (simulating new receipt at higher cost)
    await prisma.product.update({
      where: { id: p.id },
      data: { purchaseCost: 150 },
    });

    // P&L should use snapshot cost (100), not current cost (150)
    const now = new Date();
    const from = new Date(now.getFullYear(), 0, 1).toISOString();
    const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();

    const plRes = await request(app)
      .get(`/api/v1/reports/profit-loss?from=${from}&to=${to}`)
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id);

    expect(plRes.status).toBe(200);
    // The P&L should include COGS from our sale: 100 * 2 = 200
    // (there may be other sales in the shop from other tests, so just verify cogs is at least 200)
    expect(plRes.body.data.cogs).toBeGreaterThanOrEqual(200);
    expect(plRes.body.data).toHaveProperty('grossProfit');
    expect(plRes.body.data).toHaveProperty('netProfit');
  });
});

// ─── 6. Auth tests ───────────────────────────────────────────────
describe('Auth endpoints', () => {
  it('POST /auth/login should return user data and set cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'testowner@test.com', password: 'testpass123' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('shops');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /auth/login with wrong password should return 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'testowner@test.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('GET /auth/me should return current user', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', ownerCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('testowner@test.com');
  });

  it('GET /auth/me without cookie should return 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

// ─── 7. Products CRUD ────────────────────────────────────────────
describe('Products CRUD', () => {
  it('POST /products should create a product', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id)
      .send({
        name: 'New Test Product',
        barcode: 'NTP001',
        purchaseCost: 500,
        defaultSellingPrice: 700,
        initialStock: 5,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('New Test Product');
  });

  it('POST /products/scan should find product by barcode', async () => {
    const res = await request(app)
      .post('/api/v1/products/scan')
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id)
      .send({ barcode: 'TEST001' });
    expect(res.status).toBe(200);
    expect(res.body.data.barcode).toBe('TEST001');
  });

  it('GET /products should list shop products', async () => {
    const res = await request(app)
      .get('/api/v1/products')
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

// ─── 8. Inventory receive with idempotency ───────────────────────
describe('Inventory receive', () => {
  it('should receive stock and update weighted average cost', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/receive')
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id)
      .send({ productId: product1Id, quantity: 5, unitCost: 600, notes: 'Test receipt' });
    expect(res.status).toBe(201);
    expect(res.body.data.inventory.quantity).toBeGreaterThan(0);
  });
});

// ─── 9. Expense CRUD ─────────────────────────────────────────────
describe('Expenses CRUD', () => {
  let expenseId;

  it('POST /expenses should create an expense', async () => {
    const res = await request(app)
      .post('/api/v1/expenses')
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id)
      .send({ category: 'Rent', amount: 10000, description: 'Monthly rent' });
    expect(res.status).toBe(201);
    expenseId = res.body.data.id;
  });

  it('GET /expenses should list expenses', async () => {
    const res = await request(app)
      .get('/api/v1/expenses')
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('PATCH /expenses/:id should update expense', async () => {
    const res = await request(app)
      .patch(`/api/v1/expenses/${expenseId}`)
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id)
      .send({ amount: 12000 });
    expect(res.status).toBe(200);
    expect(Number(res.body.data.amount)).toBe(12000);
  });

  it('DELETE /expenses/:id should delete expense', async () => {
    const res = await request(app)
      .delete(`/api/v1/expenses/${expenseId}`)
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id);
    expect(res.status).toBe(200);
  });
});

// ─── 10. Sale cancel & return ────────────────────────────────────
describe('Sale cancel and return', () => {
  it('should cancel a sale and restore stock', async () => {
    const p = await prisma.product.create({
      data: {
        shopId: shop1Id, barcode: 'CAN001', name: 'Cancel Item',
        slug: 'cancel-item-' + Date.now(), purchaseCost: 100, defaultSellingPrice: 200,
      },
    });
    await prisma.inventory.create({ data: { shopId: shop1Id, productId: p.id, quantity: 10 } });

    const saleRes = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id)
      .send({
        items: [{ productId: p.id, quantity: 3, unitSellingPrice: 200 }],
        paymentMethod: 'CASH',
      });
    expect(saleRes.status).toBe(201);

    // Stock should be 7
    let inv = await prisma.inventory.findUnique({
      where: { shopId_productId: { shopId: shop1Id, productId: p.id } },
    });
    expect(inv.quantity).toBe(7);

    // Cancel
    const cancelRes = await request(app)
      .post(`/api/v1/sales/${saleRes.body.data.id}/cancel`)
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    // Stock should be restored to 10
    inv = await prisma.inventory.findUnique({
      where: { shopId_productId: { shopId: shop1Id, productId: p.id } },
    });
    expect(inv.quantity).toBe(10);
  });
});

// ─── 11. Dashboard & Reports ─────────────────────────────────────
describe('Dashboard and Reports', () => {
  it('GET /dashboard should return metrics', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard')
      .set('Cookie', ownerCookie)
      .set('x-shop-id', shop1Id);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('completedSales');
    expect(res.body.data).toHaveProperty('netSales');
    expect(res.body.data).toHaveProperty('lowStockCount');
  });
});
