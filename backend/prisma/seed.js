import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configurable shop definitions (Time Centre Mobile & Electronics)
const SHOPS_CONFIG = [
  {
    name: process.env.INIT_SHOP1_NAME || 'Time Centre - Main Road',
    code: process.env.INIT_SHOP1_CODE || 'TC1',
    slug: process.env.INIT_SHOP1_SLUG || 'time-centre-main-road',
    contactPhone: process.env.INIT_SHOP1_PHONE || '7004114744',
    contactEmail: process.env.INIT_SHOP1_EMAIL || 'owner@electronics.com',
    address: process.env.INIT_SHOP1_ADDRESS || 'Main road Bishnugarh Near by Axis Bank Bishnugarh',
    timezone: 'Asia/Kolkata',
    pricingRule: { threshold: 1000, addend: 100, multiplier: 1.10 },
  },
  {
    name: process.env.INIT_SHOP2_NAME || 'Time Centre - Akhara Chowk',
    code: process.env.INIT_SHOP2_CODE || 'TC2',
    slug: process.env.INIT_SHOP2_SLUG || 'time-centre-akhara-chowk',
    contactPhone: process.env.INIT_SHOP2_PHONE || '7004114744',
    contactEmail: process.env.INIT_SHOP2_EMAIL || 'owner2@electronics.com',
    address: process.env.INIT_SHOP2_ADDRESS || 'Akhara Chowck Bishnugarh',
    timezone: 'Asia/Kolkata',
    pricingRule: { threshold: 1000, addend: 100, multiplier: 1.10 },
  },
];

async function seed() {
  console.log('🌱 Seeding Time Centre Mobile & Electronics database...');

  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Seed script refused to run in production.');
    process.exit(1);
  }

  // This script DESTROYS all existing data. Require explicit confirmation
  // outside of an automated test environment.
  const confirmed =
    process.env.NODE_ENV === 'test' ||
    process.env.ALLOW_DESTRUCTIVE_SEED === 'true';

  if (!confirmed) {
    console.error(
      [
        '',
        '❌ Refusing to run: this seed script deletes ALL existing data.',
        '',
        '   If this is a throwaway development database, re-run with:',
        '     PowerShell:  $env:ALLOW_DESTRUCTIVE_SEED="true"; npm run prisma:seed',
        '     Bash:        ALLOW_DESTRUCTIVE_SEED=true npm run prisma:seed',
        '',
        '   Never run this against a database that holds real data.',
        '',
      ].join('\n')
    );
    process.exit(1);
  }

  // Clean existing data
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

  // Create independent owners
  const passwordHash = await bcrypt.hash(process.env.INIT_SHOP1_OWNER_PASSWORD || 'Owner@12345', 10);
  const superPasswordHash = await bcrypt.hash('super123', 10);

  const owner1 = await prisma.user.create({
    data: {
      email: process.env.INIT_SHOP1_OWNER_EMAIL || 'owner@electronics.com',
      name: 'Main Road Branch Owner',
      passwordHash,
      role: 'OWNER',
    },
  });

  const owner2 = await prisma.user.create({
    data: {
      email: process.env.INIT_SHOP2_OWNER_EMAIL || 'owner2@electronics.com',
      name: 'Akhara Chowk Branch Owner',
      passwordHash,
      role: 'OWNER',
    },
  });

  const superOwner = await prisma.user.create({
    data: {
      email: 'superowner@timecentre.com',
      name: 'Business Super Owner',
      passwordHash: superPasswordHash,
      role: 'SUPER_OWNER',
    },
  });

  console.log('  ✅ Users created:', owner1.email, owner2.email, superOwner.email);

  // Create two shops
  const shop1 = await prisma.shop.create({
    data: SHOPS_CONFIG[0],
  });

  const shop2 = await prisma.shop.create({
    data: SHOPS_CONFIG[1],
  });
  console.log('  ✅ Shops created:', shop1.name, '&', shop2.name);

  // Memberships: Each owner is tied strictly to their respective shop; superOwner gets both.
  await prisma.shopMembership.createMany({
    data: [
      { userId: owner1.id, shopId: shop1.id, role: 'OWNER' },
      { userId: owner2.id, shopId: shop2.id, role: 'OWNER' },
      { userId: superOwner.id, shopId: shop1.id, role: 'SUPER_OWNER' },
      { userId: superOwner.id, shopId: shop2.id, role: 'SUPER_OWNER' },
    ],
  });
  console.log('  ✅ Independent memberships assigned');

  // Tax categories
  const gst18_s1 = await prisma.taxCategory.create({
    data: { shopId: shop1.id, name: 'GST 18%', rate: 18.0, isDefault: true },
  });
  const gst12_s1 = await prisma.taxCategory.create({
    data: { shopId: shop1.id, name: 'GST 12%', rate: 12.0 },
  });
  const gst18_s2 = await prisma.taxCategory.create({
    data: { shopId: shop2.id, name: 'GST 18%', rate: 18.0, isDefault: true },
  });
  const gst12_s2 = await prisma.taxCategory.create({
    data: { shopId: shop2.id, name: 'GST 12%', rate: 12.0 },
  });
  console.log('  ✅ Tax categories created');

  // Sample products for Shop 1
  const products1 = [
    {
      name: 'USB-C Cable 1m Fast Charging',
      barcode: 'USB001',
      brand: 'Anker',
      model: 'A8187',
      category: 'Accessories',
      purchaseCost: 250,
      defaultSellingPrice: 350,
      taxCategoryId: gst18_s1.id,
      initialStock: 50,
      warranty: '1 Year Brand Warranty',
    },
    {
      name: 'Wireless Bluetooth Speaker',
      barcode: 'SPK001',
      brand: 'JBL',
      model: 'Go 3',
      category: 'Audio',
      purchaseCost: 2500,
      defaultSellingPrice: 3499,
      taxCategoryId: gst18_s1.id,
      initialStock: 20,
      warranty: '1 Year Manufacturer Warranty',
    },
    {
      name: 'Optical Wireless Mouse',
      barcode: 'MOU001',
      brand: 'Logitech',
      model: 'M240',
      category: 'Peripherals',
      purchaseCost: 600,
      defaultSellingPrice: 700,
      taxCategoryId: gst12_s1.id,
      initialStock: 30,
      warranty: '2 Years Replacement Warranty',
    },
    {
      name: 'Fast Phone Charger 25W',
      barcode: null,
      brand: 'Samsung',
      model: 'EP-TA800',
      category: 'Chargers',
      purchaseCost: 800,
      defaultSellingPrice: 900,
      taxCategoryId: gst18_s1.id,
      initialStock: 15,
      warranty: '6 Months Warranty',
    },
  ];

  for (const p of products1) {
    const slug = p.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') + '-' + Date.now().toString(36);
    const product = await prisma.product.create({
      data: {
        shopId: shop1.id,
        barcode: p.barcode,
        name: p.name,
        slug,
        brand: p.brand,
        model: p.model,
        category: p.category,
        purchaseCost: p.purchaseCost,
        defaultSellingPrice: p.defaultSellingPrice,
        taxCategoryId: p.taxCategoryId,
        warranty: p.warranty,
      },
    });
    await prisma.inventory.create({
      data: { shopId: shop1.id, productId: product.id, quantity: p.initialStock },
    });
    if (p.initialStock > 0) {
      await prisma.stockMovement.create({
        data: {
          shopId: shop1.id,
          productId: product.id,
          movementType: 'OPENING',
          quantityDelta: p.initialStock,
          unitCost: p.purchaseCost,
          notes: 'Seed opening stock',
          createdBy: owner1.id,
        },
      });
    }
  }

  // Sample products for Shop 2
  const products2 = [
    {
      name: 'Braided HDMI Cable 4K 2m',
      barcode: 'HDMI001',
      brand: 'Belkin',
      model: 'AV10175bt2M',
      category: 'Cables',
      purchaseCost: 400,
      defaultSellingPrice: 500,
      taxCategoryId: gst18_s2.id,
      initialStock: 40,
      warranty: '2 Years Belkin Warranty',
    },
    {
      name: 'Fast Charging Power Bank 10000mAh',
      barcode: 'PB001',
      brand: 'MI',
      model: 'PLM13ZM',
      category: 'Power Banks',
      purchaseCost: 1200,
      defaultSellingPrice: 1599,
      taxCategoryId: gst18_s2.id,
      initialStock: 25,
      warranty: '1 Year Warranty',
    },
  ];

  for (const p of products2) {
    const slug = p.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') + '-' + Date.now().toString(36);
    const product = await prisma.product.create({
      data: {
        shopId: shop2.id,
        barcode: p.barcode,
        name: p.name,
        slug,
        brand: p.brand,
        model: p.model,
        category: p.category,
        purchaseCost: p.purchaseCost,
        defaultSellingPrice: p.defaultSellingPrice,
        taxCategoryId: p.taxCategoryId,
        warranty: p.warranty,
      },
    });
    await prisma.inventory.create({
      data: { shopId: shop2.id, productId: product.id, quantity: p.initialStock },
    });
    if (p.initialStock > 0) {
      await prisma.stockMovement.create({
        data: {
          shopId: shop2.id,
          productId: product.id,
          movementType: 'OPENING',
          quantityDelta: p.initialStock,
          unitCost: p.purchaseCost,
          notes: 'Seed opening stock',
          createdBy: owner2.id,
        },
      });
    }
  }

  console.log('  ✅ Sample products and inventory created');

  // Invoice sequences
  const currentYear = new Date().getFullYear();
  await prisma.invoiceSequence.createMany({
    data: [
      { shopId: shop1.id, year: currentYear, lastNumber: 0 },
      { shopId: shop2.id, year: currentYear, lastNumber: 0 },
    ],
  });
  console.log('  ✅ Invoice sequences initialized');

  console.log('🎉 Seed completed successfully!');
  console.log('\n📋 Login credentials:');
  console.log('   Shop 1 Owner: owner1@timecentre.com / owner123');
  console.log('   Shop 2 Owner: owner2@timecentre.com / owner123');
  console.log('   Super Owner:  superowner@timecentre.com / super123');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
