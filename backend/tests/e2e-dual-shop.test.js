import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

let owner1Cookie;
let owner2Cookie;
let shop1Id;
let shop2Id;
let shop1Slug = 'time-centre-shop-1';
let shop2Slug = 'time-centre-shop-2';
let product1Id;
let product2Id;

async function loginUser(email, password = 'testpassword123') {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  const cookies = res.headers['set-cookie'];
  if (!cookies) throw new Error(`No cookie returned from login for ${email}: status=${res.status} body=${JSON.stringify(res.body)}`);
  return Array.isArray(cookies) ? cookies[0] : cookies;
}

beforeAll(async () => {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
    throw new Error('Safety check: Tests must run against dedicated test database with ALLOW_DESTRUCTIVE_TESTS=true');
  }

  // Clean test tables in test database
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

  const passwordHash = await bcrypt.hash('testpassword123', 10);

  // Create isolated owners
  const user1 = await prisma.user.create({
    data: { email: 'owner1@timecentre.com', name: 'Owner Shop 1', passwordHash, role: 'OWNER' },
  });

  const user2 = await prisma.user.create({
    data: { email: 'owner2@timecentre.com', name: 'Owner Shop 2', passwordHash, role: 'OWNER' },
  });

  // Create two shops
  const shop1 = await prisma.shop.create({
    data: {
      name: 'Time Centre - Shop 1',
      code: 'TC1',
      slug: shop1Slug,
      address: 'Shop 101, Ground Floor, Central Mall',
      contactPhone: '+91 98765 11111',
      gstin: '29AAAAA1111A1Z1',
      invoicePrefix: 'TC1-2026',
      invoiceFooter: 'Thank you for shopping at Time Centre Shop 1!',
      timezone: 'Asia/Kolkata',
    },
  });

  const shop2 = await prisma.shop.create({
    data: {
      name: 'Time Centre - Shop 2',
      code: 'TC2',
      slug: shop2Slug,
      address: 'Shop 202, First Floor, Market Complex',
      contactPhone: '+91 98765 22222',
      gstin: '29BBBBB2222B2Z2',
      invoicePrefix: 'TC2-2026',
      invoiceFooter: 'Thank you for shopping at Time Centre Shop 2!',
      timezone: 'Asia/Kolkata',
    },
  });

  shop1Id = shop1.id;
  shop2Id = shop2.id;

  // Single shop membership per owner
  await prisma.shopMembership.createMany({
    data: [
      { userId: user1.id, shopId: shop1Id, role: 'OWNER' },
      { userId: user2.id, shopId: shop2Id, role: 'OWNER' },
    ],
  });

  // Default tax categories
  await prisma.taxCategory.createMany({
    data: [
      { shopId: shop1Id, name: 'GST 18%', rate: 18.0, isDefault: true },
      { shopId: shop2Id, name: 'GST 18%', rate: 18.0, isDefault: true },
    ],
  });

  // Initialize invoice sequences for current year
  const year = new Date().getFullYear();
  await prisma.invoiceSequence.createMany({
    data: [
      { shopId: shop1Id, year, lastNumber: 0 },
      { shopId: shop2Id, year, lastNumber: 0 },
    ],
  });

  // Log in each owner
  owner1Cookie = await loginUser('owner1@timecentre.com');
  owner2Cookie = await loginUser('owner2@timecentre.com');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Dual-Shop Concurrent End-to-End Simulation', () => {
  it('Step 1: Both owners concurrently create products and receive stock', async () => {
    // Owner 1 creates product in Shop 1
    const resProduct1 = await request(app)
      .post('/api/v1/products')
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id)
      .send({
        name: 'Galaxy Watch 6',
        barcode: 'TC1-WATCH-001',
        brand: 'Samsung',
        model: 'Watch 6',
        category: 'Wearables',
        purchaseCost: 10000,
        defaultSellingPrice: 15000,
        warranty: '1 Year Brand Warranty',
      });
    expect(resProduct1.status).toBe(201);
    product1Id = resProduct1.body.data.id;

    // Owner 2 creates product in Shop 2
    const resProduct2 = await request(app)
      .post('/api/v1/products')
      .set('Cookie', owner2Cookie)
      .set('x-shop-id', shop2Id)
      .send({
        name: 'iPad Air M2',
        barcode: 'TC2-IPAD-001',
        brand: 'Apple',
        model: 'Air M2',
        category: 'Tablets',
        purchaseCost: 40000,
        defaultSellingPrice: 55000,
        warranty: '1 Year Apple Care',
      });
    expect(resProduct2.status).toBe(201);
    product2Id = resProduct2.body.data.id;

    // Concurrently receive 30 units of stock in each shop
    const [recv1, recv2] = await Promise.all([
      request(app)
        .post('/api/v1/inventory/receive')
        .set('Cookie', owner1Cookie)
        .set('x-shop-id', shop1Id)
        .send({ productId: product1Id, quantity: 30, unitCost: 10000, notes: 'Opening Batch Shop 1' }),
      request(app)
        .post('/api/v1/inventory/receive')
        .set('Cookie', owner2Cookie)
        .set('x-shop-id', shop2Id)
        .send({ productId: product2Id, quantity: 30, unitCost: 40000, notes: 'Opening Batch Shop 2' }),
    ]);

    expect(recv1.status).toBe(201);
    expect(recv1.body.data.inventory.quantity).toBe(30);

    expect(recv2.status).toBe(201);
    expect(recv2.body.data.inventory.quantity).toBe(30);
  });

  it('Step 2: Concurrently complete 20 parallel sales in Shop 1 and 20 parallel sales in Shop 2 (40 parallel sales total)', async () => {
    // Helper to execute tasks with concurrency limit
    const runInChunks = async (taskFns, chunkSize = 5) => {
      const results = [];
      for (let i = 0; i < taskFns.length; i += chunkSize) {
        const chunk = taskFns.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk.map((fn) => fn()));
        results.push(...chunkResults);
      }
      return results;
    };

    const shop1SaleTasks = Array.from({ length: 20 }, (_, i) => {
      const idx = i + 1;
      return () =>
        request(app)
          .post('/api/v1/sales')
          .set('Cookie', owner1Cookie)
          .set('x-shop-id', shop1Id)
          .set('Idempotency-Key', `shop1-sale-idemp-${idx}-${Date.now()}`)
          .send({
            customerName: `Shop 1 Customer ${idx}`,
            customerPhone: `+91 98000 ${String(idx).padStart(5, '0')}`,
            items: [
              {
                productId: product1Id,
                quantity: 1,
                unitSellingPrice: 15000,
                discountAmount: 0,
                serialNumber: `SN-S1-WATCH-${String(idx).padStart(4, '0')}`,
              },
            ],
            paymentMethod: 'UPI',
          });
    });

    const shop2SaleTasks = Array.from({ length: 20 }, (_, i) => {
      const idx = i + 1;
      return () =>
        request(app)
          .post('/api/v1/sales')
          .set('Cookie', owner2Cookie)
          .set('x-shop-id', shop2Id)
          .set('Idempotency-Key', `shop2-sale-idemp-${idx}-${Date.now()}`)
          .send({
            customerName: `Shop 2 Customer ${idx}`,
            customerPhone: `+91 99000 ${String(idx).padStart(5, '0')}`,
            items: [
              {
                productId: product2Id,
                quantity: 1,
                unitSellingPrice: 55000,
                discountAmount: 0,
                serialNumber: `SN-S2-IPAD-${String(idx).padStart(4, '0')}`,
              },
            ],
            paymentMethod: 'CARD',
          });
    });

    // Run Shop 1 and Shop 2 sales simultaneously
    const [shop1Results, shop2Results] = await Promise.all([
      runInChunks(shop1SaleTasks, 5),
      runInChunks(shop2SaleTasks, 5),
    ]);

    const allResults = [...shop1Results, ...shop2Results];

    // Verify all 40 sales succeeded
    for (const res of allResults) {
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('COMPLETED');
    }
  });

  it('Step 3: Concurrently record operating expenses in each shop', async () => {
    const [exp1, exp2] = await Promise.all([
      request(app)
        .post('/api/v1/expenses')
        .set('Cookie', owner1Cookie)
        .set('x-shop-id', shop1Id)
        .send({ category: 'Rent', amount: 12000, description: 'Shop 1 Mall Lease' }),
      request(app)
        .post('/api/v1/expenses')
        .set('Cookie', owner2Cookie)
        .set('x-shop-id', shop2Id)
        .send({ category: 'Marketing', amount: 8000, description: 'Shop 2 Local Ads' }),
    ]);

    expect(exp1.status).toBe(201);
    expect(exp2.status).toBe(201);
  });

  it('(a) Metric Isolation: Each shop dashboard, inventory, and P&L contain only that shop numbers', async () => {
    // Check Shop 1 Dashboard
    const dash1 = await request(app)
      .get('/api/v1/dashboard')
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id);
    expect(dash1.status).toBe(200);
    expect(dash1.body.data.completedSales).toBe(20);
    expect(dash1.body.data.netSales).toBe(300000); // 20 * 15000

    // Check Shop 2 Dashboard
    const dash2 = await request(app)
      .get('/api/v1/dashboard')
      .set('Cookie', owner2Cookie)
      .set('x-shop-id', shop2Id);
    expect(dash2.status).toBe(200);
    expect(dash2.body.data.completedSales).toBe(20);
    expect(dash2.body.data.netSales).toBe(1100000); // 20 * 55000

    // Check Inventory remaining (30 - 20 = 10 each)
    const inv1 = await prisma.inventory.findUnique({
      where: { shopId_productId: { shopId: shop1Id, productId: product1Id } },
    });
    expect(inv1.quantity).toBe(10);

    const inv2 = await prisma.inventory.findUnique({
      where: { shopId_productId: { shopId: shop2Id, productId: product2Id } },
    });
    expect(inv2.quantity).toBe(10);

    // Check P&L for Shop 1
    const now = new Date();
    const from = new Date(now.getFullYear(), 0, 1).toISOString();
    const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();

    const pl1 = await request(app)
      .get(`/api/v1/reports/profit-loss?from=${from}&to=${to}`)
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id);
    expect(pl1.status).toBe(200);
    expect(pl1.body.data.salesCount).toBe(20);
    expect(pl1.body.data.netSales).toBe(300000);
    expect(pl1.body.data.cogs).toBe(200000); // 20 * 10000 cost
    expect(pl1.body.data.grossProfit).toBe(100000);
    expect(pl1.body.data.operatingExpenses).toBe(12000);
    expect(pl1.body.data.netProfit).toBe(88000); // 100000 - 12000

    // Check P&L for Shop 2
    const pl2 = await request(app)
      .get(`/api/v1/reports/profit-loss?from=${from}&to=${to}`)
      .set('Cookie', owner2Cookie)
      .set('x-shop-id', shop2Id);
    expect(pl2.status).toBe(200);
    expect(pl2.body.data.salesCount).toBe(20);
    expect(pl2.body.data.netSales).toBe(1100000);
    expect(pl2.body.data.cogs).toBe(800000); // 20 * 40000 cost
    expect(pl2.body.data.grossProfit).toBe(300000);
    expect(pl2.body.data.operatingExpenses).toBe(8000);
    expect(pl2.body.data.netProfit).toBe(292000); // 300000 - 8000
  });

  it('(b) Sequential & Unique Invoices: Numbers are strictly sequential and unique per shop', async () => {
    const salesShop1 = await prisma.sale.findMany({
      where: { shopId: shop1Id },
      orderBy: { invoiceNumber: 'asc' },
    });
    expect(salesShop1.length).toBe(20);

    const year = new Date().getFullYear();
    const expectedPrefix1 = `TC1-${year}-`;
    const expectedPrefix2 = `TC2-${year}-`;

    const numbers1 = salesShop1.map((s) => s.invoiceNumber);
    for (let i = 1; i <= 20; i++) {
      const expected = `${expectedPrefix1}${String(i).padStart(6, '0')}`;
      expect(numbers1).toContain(expected);
    }
    // Verify all 20 are unique
    expect(new Set(numbers1).size).toBe(20);

    const salesShop2 = await prisma.sale.findMany({
      where: { shopId: shop2Id },
      orderBy: { invoiceNumber: 'asc' },
    });
    expect(salesShop2.length).toBe(20);

    const numbers2 = salesShop2.map((s) => s.invoiceNumber);
    for (let i = 1; i <= 20; i++) {
      const expected = `${expectedPrefix2}${String(i).padStart(6, '0')}`;
      expect(numbers2).toContain(expected);
    }
    expect(new Set(numbers2).size).toBe(20);
  });

  it('(c) Cross-Shop Security: No cross-shop access is possible between owner1 and owner2', async () => {
    // Owner 1 cannot read Shop 2 product
    const pRes = await request(app)
      .get(`/api/v1/products/${product2Id}`)
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id);
    expect(pRes.status).toBe(404);

    // Owner 2 cannot read Shop 1 product
    const pRes2 = await request(app)
      .get(`/api/v1/products/${product1Id}`)
      .set('Cookie', owner2Cookie)
      .set('x-shop-id', shop2Id);
    expect(pRes2.status).toBe(404);

    // Owner 1 cannot bill Shop 2 product in Shop 1
    const crossBill = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop1Id)
      .send({
        items: [{ productId: product2Id, quantity: 1, unitSellingPrice: 55000 }],
        paymentMethod: 'CASH',
      });
    expect(crossBill.status).toBe(404);

    // Owner 1 cannot access Shop 2 dashboard or report by setting x-shop-id
    const crossDash = await request(app)
      .get('/api/v1/dashboard')
      .set('Cookie', owner1Cookie)
      .set('x-shop-id', shop2Id);
    expect([403, 404]).toContain(crossDash.status);
  });

  it('(d) Public Storefront Isolation: Public endpoints display accurate per-shop products and stock', async () => {
    // Public listing for Shop 1
    const pub1 = await request(app).get(`/api/v1/public/shops/${shop1Slug}/products`);
    expect(pub1.status).toBe(200);
    expect(pub1.body.data.length).toBe(1);
    expect(pub1.body.data[0].id).toBe(product1Id);
    expect(pub1.body.data[0].name).toBe('Galaxy Watch 6');
    expect(pub1.body.data[0].inStock).toBe(true);
    // Crucial: no unit costs or exact quantities leaked
    expect(pub1.body.data[0]).not.toHaveProperty('purchaseCost');
    expect(pub1.body.data[0]).not.toHaveProperty('quantity');

    // Public listing for Shop 2
    const pub2 = await request(app).get(`/api/v1/public/shops/${shop2Slug}/products`);
    expect(pub2.status).toBe(200);
    expect(pub2.body.data.length).toBe(1);
    expect(pub2.body.data[0].id).toBe(product2Id);
    expect(pub2.body.data[0].name).toBe('iPad Air M2');
    expect(pub2.body.data[0].inStock).toBe(true);

    // Public shop directory lists both shops with in-stock count = 1
    const pubShops = await request(app).get('/api/v1/public/shops');
    expect(pubShops.status).toBe(200);
    const s1 = pubShops.body.data.find((s) => s.slug === shop1Slug);
    const s2 = pubShops.body.data.find((s) => s.slug === shop2Slug);
    expect(s1).toBeDefined();
    expect(s1.inStockCount).toBe(1);
    expect(s2).toBeDefined();
    expect(s2.inStockCount).toBe(1);
  });
});
