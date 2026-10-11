import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

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

  // Create owner
  const passwordHash = await bcrypt.hash('owner123', 10);
  const owner = await prisma.user.create({
    data: {
      email: 'owner@electronics.com',
      name: 'Shop Owner',
      passwordHash,
      role: 'OWNER',
    },
  });
  console.log('  ✅ Owner created:', owner.email);

  // Create two shops
  const shop1 = await prisma.shop.create({
    data: {
      name: 'Electronics Hub - Main Street',
      code: 'EHM',
      slug: 'electronics-hub-main',
      contactPhone: '+91-9876543210',
      contactEmail: 'main@ehub.com',
      address: '123 Main Street, Mumbai',
      timezone: 'Asia/Kolkata',
      pricingRule: { threshold: 1000, addend: 100, multiplier: 1.10 },
    },
  });

  const shop2 = await prisma.shop.create({
    data: {
      name: 'Electronics Hub - Park Road',
      code: 'EHP',
      slug: 'electronics-hub-park',
      contactPhone: '+91-9876543211',
      contactEmail: 'park@ehub.com',
      address: '456 Park Road, Mumbai',
      timezone: 'Asia/Kolkata',
      pricingRule: { threshold: 1000, addend: 100, multiplier: 1.10 },
    },
  });
  console.log('  ✅ Shops created:', shop1.name, '&', shop2.name);

  // Memberships
  await prisma.shopMembership.createMany({
    data: [
      { userId: owner.id, shopId: shop1.id, role: 'OWNER' },
      { userId: owner.id, shopId: shop2.id, role: 'OWNER' },
    ],
  });

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
      name: 'USB-C Cable 1m',
      barcode: 'USB001',
      brand: 'Anker',
      model: 'A8187',
      purchaseCost: 250,
      defaultSellingPrice: 350,
      taxCategoryId: gst18_s1.id,
      initialStock: 50,
    },
    {
      name: 'Bluetooth Speaker',
      barcode: 'SPK001',
      brand: 'JBL',
      model: 'Go 3',
      purchaseCost: 2500,
      defaultSellingPrice: 3499,
      taxCategoryId: gst18_s1.id,
      initialStock: 20,
    },
    {
      name: 'Wireless Mouse',
      barcode: 'MOU001',
      brand: 'Logitech',
      model: 'M240',
      purchaseCost: 600,
      defaultSellingPrice: 700,
      taxCategoryId: gst12_s1.id,
      initialStock: 30,
    },
    {
      name: 'Phone Charger 20W',
      barcode: null,
      brand: 'Samsung',
      model: 'EP-TA800',
      purchaseCost: 800,
      defaultSellingPrice: 900,
      taxCategoryId: gst18_s1.id,
      initialStock: 15,
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
        purchaseCost: p.purchaseCost,
        defaultSellingPrice: p.defaultSellingPrice,
        taxCategoryId: p.taxCategoryId,
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
          createdBy: owner.id,
        },
      });
    }
  }

  // Sample products for Shop 2
  const products2 = [
    {
      name: 'HDMI Cable 2m',
      barcode: 'HDMI001',
      brand: 'Belkin',
      model: 'AV10175bt2M',
      purchaseCost: 400,
      defaultSellingPrice: 500,
      taxCategoryId: gst18_s2.id,
      initialStock: 40,
    },
    {
      name: 'Power Bank 10000mAh',
      barcode: 'PB001',
      brand: 'MI',
      model: 'PLM13ZM',
      purchaseCost: 1200,
      defaultSellingPrice: 1599,
      taxCategoryId: gst18_s2.id,
      initialStock: 25,
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
        purchaseCost: p.purchaseCost,
        defaultSellingPrice: p.defaultSellingPrice,
        taxCategoryId: p.taxCategoryId,
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
          createdBy: owner.id,
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
  console.log('   Email: owner@electronics.com');
  console.log('   Password: owner123');
  console.log(`   Shop 1 ID: ${shop1.id}`);
  console.log(`   Shop 2 ID: ${shop2.id}`);
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
