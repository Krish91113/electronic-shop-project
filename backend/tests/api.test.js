import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

let owner1Cookie;
let owner2Cookie;
let superOwnerCookie;
let ownerCookie; // alias for owner1Cookie for backward compat
let shop1Id;
let shop2Id;
let product1Id; // shop1 product
let product2Id; // shop2 product
let shop1Slug;
let shop2Slug;
let expense2Id;
let sale2Id;

async function loginUser(email, password = 'password123') {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  const cookies = res.headers['set-cookie'];
  if (!cookies) throw new Error(`No cookie returned from login for ${email}`);
  return Array.isArray(cookies) ? cookies[0] : cookies;
}

beforeAll(async () => {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
    throw new Error(
      'Safety check: Refusing to run tests without ALLOW_DESTRUCTIVE_TESTS=true on dedicated test database.'
    );
  }

  // Clean test tables
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

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Independent Owner 1
  const user1 = await prisma.user.create({
    data: { email: 'owner1@timecentre.com', name: 'Owner One', passwordHash, role: 'OWNER' },
  });

  // 2. Independent Owner 2
  const user2 = await prisma.user.create({
    data: { email: 'owner2@timecentre.com', name: 'Owner Two', passwordHash, role: 'OWNER' },
  });

  // 3. Super Owner (Combined View)
  const superUser = await prisma.user.create({
    data: { email: 'superowner@timecentre.com', name: 'Super Owner', passwordHash, role: 'SUPER_OWNER' },
  });

  // Create two shops
  const shop1 = await prisma.shop.create({
    data: {
      name: 'Time Centre - Shop 1',
      code: 'TC1',
      slug: 'time-centre-shop-1',
      address: '101 MG Road, Bengaluru',
      contactPhone: '+91 98765 43210',
      gstin: '29AAAAA0000A1Z1',
      invoicePrefix: 'TC1-2026',
      invoiceFooter: 'Thank you for shopping at Time Centre Shop 1!',
      timezone: 'Asia/Kolkata',
      pricingRule: { threshold: 1000, addend: 100, multiplier: 1.10 },
    },
  });

  const shop2 = await prisma.shop.create({
    data: {
      name: 'Time Centre - Shop 2',
      code: 'TC2',
      slug: 'time-centre-shop-2',
      address: '202 Commercial Street, Bengaluru',
      contactPhone: '+91 98765 43211',
      gstin: '29AAAAA0000A1Z2',
      invoicePrefix: 'TC2-2026',
      invoiceFooter: 'Thank you for shopping at Time Centre Shop 2!',
      timezone: 'Asia/Kolkata',
    },
  });

  shop1Id = shop1.id;
  shop2Id = shop2.id;
  shop1Slug = shop1.slug;
  shop2Slug = shop2.slug;

  // Memberships: Owner 1 in Shop 1 ONLY, Owner 2 in Shop 2 ONLY, Super Owner in BOTH
  await prisma.shopMembership.createMany({
    data: [
      { userId: user1.id, shopId: shop1Id, role: 'OWNER' },
      { userId: user2.id, shopId: shop2Id, role: 'OWNER' },
      { userId: superUser.id, shopId: shop1Id, role: 'SUPER_OWNER' },
      { userId: superUser.id, shopId: shop2Id, role: 'SUPER_OWNER' },
    ],
  });

  // Tax categories
  const tc1 = await prisma.taxCategory.create({
    data: { shopId: shop1Id, name: 'GST 18%', rate: 18.0, isDefault: true },
  });
  const tc2 = await prisma.taxCategory.create({
    data: { shopId: shop2Id, name: 'GST 18%', rate: 18.0, isDefault: true },
  });

  // Product in Shop 1
  const p1 = await prisma.product.create({
    data: {
      shopId: shop1Id,
      barcode: 'TEST001',
      name: 'Samsung Galaxy S24',
      slug: 'samsung-galaxy-s24-' + Date.now(),
      brand: 'Samsung',
      model: 'S24',
      category: 'Smartphones',
      warranty: '1 Year Brand Warranty',
      purchaseCost: 50000,
      defaultSellingPrice: 60000,
      taxCategoryId: tc1.id,
      isPublished: true,
      isActive: true,
    },
  });
  product1Id = p1.id;
  await prisma.inventory.create({ data: { shopId: shop1Id, productId: p1.id, quantity: 15 } });
  await prisma.stockMovement.create({
    data: {
      shopId: shop1Id,
      productId: p1.id,
      movementType: 'OPENING',
      quantityDelta: 15,
      unitCost: 50000,
      createdBy: user1.id,
    },
  });

  // Product in Shop 2
  const p2 = await prisma.product.create({
    data: {
      shopId: shop2Id,
      barcode: 'TEST002',
      name: 'Apple iPhone 15',
      slug: 'apple-iphone-15-' + Date.now(),
      brand: 'Apple',
      model: '15',
      category: 'Smartphones',
      warranty: '1 Year Apple Warranty',
      purchaseCost: 60000,
      defaultSellingPrice: 72000,
      taxCategoryId: tc2.id,
      isPublished: true,
      isActive: true,
    },
  });
  product2Id = p2.id;
  await prisma.inventory.create({ data: { shopId: shop2Id, productId: p2.id, quantity: 8 } });
  await prisma.stockMovement.create({
    data: {
      shopId: shop2Id,
      productId: p2.id,
      movementType: 'OPENING',
      quantityDelta: 8,
      unitCost: 60000,
      createdBy: user2.id,
    },
  });

  // Create an expense in Shop 2
  const exp2 = await prisma.expense.create({
    data: {
      shopId: shop2Id,
      category: 'Electricity',
      amount: 4500,
      date: new Date(),
      description: 'Shop 2 Electric Bill',
    },
  });
  expense2Id = exp2.id;

  // Create a sale in Shop 2
  const sale2 = await prisma.sale.create({
    data: {
      shopId: shop2Id,
      invoiceNumber: 'TC2-2026-000001',
      status: 'COMPLETED',
      subtotal: 72000,
      discountTotal: 0,
      taxTotal: 12960,
      totalAmount: 84960,
      paymentStatus: 'PAID',
      customerName: 'Customer in Shop 2',
      customerPhone: '+91 99999 88888',
      items: {
        create: [
          {
            productId: p2.id,
            productNameSnapshot: 'Apple iPhone 15',
            quantity: 1,
            unitSellingPrice: 72000,
            discountAmount: 0,
            taxRateSnapshot: 18,
            taxAmount: 12960,
            serialNumber: 'IMEI-IPHONE15-001',
            unitCostSnapshot: 60000,
            lineTotal: 84960,
          },
        ],
      },
    },
  });
  sale2Id = sale2.id;

  // Invoice sequences
  const year = new Date().getFullYear();
  await prisma.invoiceSequence.createMany({
    data: [
      { shopId: shop1Id, year, lastNumber: 0 },
      { shopId: shop2Id, year, lastNumber: 1 },
    ],
  });

  // Login cookies
  owner1Cookie = await loginUser('owner1@timecentre.com');
  owner2Cookie = await loginUser('owner2@timecentre.com');
  superOwnerCookie = await loginUser('superowner@timecentre.com');
  ownerCookie = owner1Cookie;
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── 1. Concurrent oversell ──────────────────────────────────────
describe('Concurrent oversell prevention', () => {
  it('should only allow one sale to succeed when stock=10 and two sales try qty=8', async () => {
    const p = await prisma.product.create({
      data: {
        shopId: shop1Id,
        barcode: 'CONC001',
        name: 'Concurrent Item',
        slug: 'concurrent-item-' + Date.now(),
        purchaseCost: 100,
        defaultSellingPrice: 200,
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
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

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
        shopId: shop1Id,
        barcode: 'IDEMP001',
        name: 'Idempotent Item',
        slug: 'idempotent-item-' + Date.now(),
        purchaseCost: 100,
        defaultSellingPrice: 150,
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

    expect(r2.status).toBe(201);
    expect(r2.body.data.id).toBe(r1.body.data.id);

    const inv = await prisma.inventory.findUnique({
      where: { shopId_productId: { shopId: shop1Id, productId: p.id } },
    });
    expect(inv.quantity).toBe(19);
  });
});

// ─── 3. Strict Cross-Shop Isolation (Task B Verification) ────────
describe('Independent Owners Cross-Shop Security Isolation', () => {
  it('owner1 gets 404 for shop2 product view and edit', async () => {
    const r1 = await request(app)
      .get(`/api/v1/products/${product2Id}`)
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id);
    expect(r1.status).toBe(404);

    const r2 = await request(app)
      .patch(`/api/v1/products/${product2Id}`)
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id)
      .send({ name: 'Hacked Name' });
    expect(r2.status).toBe(404);

    const r3 = await request(app)
      .delete(`/api/v1/products/${product2Id}`)
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id);
    expect(r3.status).toBe(404);
  });

  it('owner1 gets 404 for shop2 inventory operations', async () => {
    const r1 = await request(app)
      .post('/api/v1/inventory/receive')
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id)
      .send({ productId: product2Id, quantity: 5, unitCost: 1000 });
    expect(r1.status).toBe(404);

    const r2 = await request(app)
      .post('/api/v1/inventory/adjust')
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id)
      .send({ productId: product2Id, quantityDelta: -1, movementType: 'ADJUSTMENT' });
    expect(r2.status).toBe(404);
  });

  it('owner1 gets 404 for shop2 sales and invoices', async () => {
    const r1 = await request(app)
      .get(`/api/v1/sales/${sale2Id}`)
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id);
    expect(r1.status).toBe(404);

    const r2 = await request(app)
      .get(`/api/v1/sales/${sale2Id}/invoice`)
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id);
    expect(r2.status).toBe(404);

    const r3 = await request(app)
      .post(`/api/v1/sales/${sale2Id}/cancel`)
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id);
    expect(r3.status).toBe(404);
  });

  it('owner1 gets 404 for shop2 expenses', async () => {
    const r1 = await request(app)
      .get(`/api/v1/expenses/${expense2Id}`)
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id);
    expect(r1.status).toBe(404);

    const r2 = await request(app)
      .patch(`/api/v1/expenses/${expense2Id}`)
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id)
      .send({ amount: 99999 });
    expect(r2.status).toBe(404);

    const r3 = await request(app)
      .delete(`/api/v1/expenses/${expense2Id}`)
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id);
    expect(r3.status).toBe(404);
  });

  it('owner1 gets 404/403 when trying to access shop2 reports, dashboard, or shop PATCH', async () => {
    // Attempt to access shop2 reports using shop2 header as owner1
    const r1 = await request(app)
      .get('/api/v1/reports/profit-loss?from=2026-01-01&to=2026-12-31')
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop2Id);
    expect([403, 404]).toContain(r1.status);

    // Attempt to access shop2 dashboard
    const r2 = await request(app)
      .get('/api/v1/dashboard')
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop2Id);
    expect([403, 404]).toContain(r2.status);

    // Attempt to PATCH shop2
    const r3 = await request(app)
      .patch(`/api/v1/shops/${shop2Id}`)
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id)
      .send({ name: 'Compromised Shop 2' });
    expect([403, 404]).toContain(r3.status);
  });

  it('owner1 gets 404 for shop2 product images', async () => {
    const r1 = await request(app)
      .post('/api/v1/images/signed-upload')
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id)
      .send({ productId: product2Id });
    expect(r1.status).toBe(404);

    const r2 = await request(app)
      .delete('/api/v1/images/00000000-0000-0000-0000-000000000000')
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id);
    expect(r2.status).toBe(404);
  });
});

// ─── 4. Public Endpoints Verification ────────────────────────────
describe('Public Storefront Endpoints', () => {
  it('GET /public/shops returns list of shops with only public fields', async () => {
    const res = await request(app).get('/api/v1/public/shops');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);

    for (const s of res.body.data) {
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('slug');
      expect(s).toHaveProperty('productCount');
      expect(s).toHaveProperty('inStockCount');
      expect(s).not.toHaveProperty('id');
      expect(s).not.toHaveProperty('purchaseCost');
      expect(s).not.toHaveProperty('pricingRule');
      expect(s).not.toHaveProperty('memberships');
      expect(s).not.toHaveProperty('users');
    }
  });

  it('GET /public/shops/:shopSlug returns single shop public details or 404', async () => {
    const res = await request(app).get(`/api/v1/public/shops/${shop1Slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Time Centre - Shop 1');
    expect(res.body.data.slug).toBe(shop1Slug);
    expect(res.body.data).not.toHaveProperty('id');

    const notFound = await request(app).get('/api/v1/public/shops/non-existent-slug');
    expect(notFound.status).toBe(404);
  });

  it('GET /public/shops/:shopSlug/products supports inStock, category, search, and pagination', async () => {
    const res = await request(app)
      .get(`/api/v1/public/shops/${shop1Slug}/products?inStock=true&category=Smartphones&page=1&limit=10`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('pagination');

    for (const p of res.body.data) {
      expect(p.inStock).toBe(true);
      expect(p.category).toBe('Smartphones');
      expect(p).not.toHaveProperty('purchaseCost');
      expect(p).not.toHaveProperty('unitCostSnapshot');
      expect(p).not.toHaveProperty('quantity'); // exact count hidden
    }
  });

  it('/shops/shop1/products never returns shop2 products', async () => {
    const res = await request(app).get(`/api/v1/public/shops/${shop1Slug}/products`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((p) => p.id);
    expect(ids).toContain(product1Id);
    expect(ids).not.toContain(product2Id);
  });
});

// ─── 5. Printable Customer Bill & New Fields Verification ────────
describe('Printable Customer Bill and Invoicing Enhancements', () => {
  it('creates sale with customerName, customerPhone, serialNumber and retrieves rich invoice', async () => {
    const salePayload = {
      customerName: 'Vikram Mehta',
      customerPhone: '+91 98888 77777',
      items: [
        {
          productId: product1Id,
          quantity: 1,
          unitSellingPrice: 60000,
          discountAmount: 1000,
          serialNumber: 'IMEI-S24-998877',
        },
      ],
      paymentMethod: 'UPI',
    };

    const createRes = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id)
      .send(salePayload);

    expect(createRes.status).toBe(201);
    const saleId = createRes.body.data.id;

    // Fetch invoice payload
    const invRes = await request(app)
      .get(`/api/v1/sales/${saleId}/invoice`)
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id);

    expect(invRes.status).toBe(200);
    const inv = invRes.body.data;

    // Verify customer info
    expect(inv.customerName).toBe('Vikram Mehta');
    expect(inv.customerPhone).toBe('+91 98888 77777');

    // Verify shop info (with GSTIN & invoice footer)
    expect(inv.shop).toBeDefined();
    expect(inv.shop.name).toBe('Time Centre - Shop 1');
    expect(inv.shop.gstin).toBe('29AAAAA0000A1Z1');
    expect(inv.shop.invoiceFooter).toBe('Thank you for shopping at Time Centre Shop 1!');

    // Verify items (with IMEI/serial and warranty)
    expect(inv.items.length).toBe(1);
    expect(inv.items[0].serialNumber).toBe('IMEI-S24-998877');
    expect(inv.items[0].product.warranty).toBe('1 Year Brand Warranty');
    expect(Number(inv.items[0].taxRateSnapshot)).toBe(18);
    expect(Number(inv.items[0].taxAmount)).toBeGreaterThan(0);

    // Verify payments & status
    expect(inv.payments.length).toBe(1);
    expect(inv.payments[0].method).toBe('UPI');
    expect(inv.status).toBe('COMPLETED');
  });

  it('updates Shop.gstin via PATCH /shops/:id', async () => {
    const patchRes = await request(app)
      .patch(`/api/v1/shops/${shop1Id}`)
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id)
      .send({ gstin: '29BBBBB1111B2Z3' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.gstin).toBe('29BBBBB1111B2Z3');
  });
});

// ─── 6. Super Owner Access ───────────────────────────────────────
describe('Super Owner Multi-Shop Access', () => {
  it('superowner can access both shop1 and shop2 data cleanly', async () => {
    const r1 = await request(app)
      .get('/api/v1/dashboard')
      .set('Cookie', superOwnerCookie)
      .set('x-shop-id', shop1Id);
    expect(r1.status).toBe(200);

    const r2 = await request(app)
      .get('/api/v1/dashboard')
      .set('Cookie', superOwnerCookie)
      .set('x-shop-id', shop2Id);
    expect(r2.status).toBe(200);
  });
});
