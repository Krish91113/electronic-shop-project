import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function initProduction() {
  console.log('🚀 Running safe, idempotent database initialization...');

  const ownerEmail = process.env.INIT_OWNER_EMAIL || 'owner@electronics.com';
  const ownerPassword = process.env.INIT_OWNER_PASSWORD;
  const ownerName = process.env.INIT_OWNER_NAME || 'Store Owner';

  if (!ownerPassword && process.env.NODE_ENV === 'production') {
    console.error('❌ INIT_OWNER_PASSWORD environment variable is required to create initial owner in production.');
    process.exit(1);
  }

  const effectivePassword = ownerPassword || 'Owner@12345';

  // 1. Check or create initial Owner
  let owner = await prisma.user.findUnique({
    where: { email: ownerEmail },
  });

  if (!owner) {
    console.log(`👤 Creating initial owner user: ${ownerEmail}`);
    const passwordHash = await bcrypt.hash(effectivePassword, 10);
    owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        name: ownerName,
        passwordHash,
        role: 'OWNER',
        isActive: true,
      },
    });
    console.log('✅ Initial owner user created successfully.');
  } else {
    console.log(`ℹ️ Owner user (${ownerEmail}) already exists. Preserving existing record.`);
  }

  // 2. Initial Shops (Idempotent by code)
  const defaultShops = [
    {
      code: 'EHM',
      name: 'Electronics Hub - Main Street',
      slug: 'electronics-hub-main',
      contactPhone: '+91-9876543210',
      contactEmail: 'main@ehub.com',
      address: '123 Main Street, Mumbai',
      timezone: 'Asia/Kolkata',
      pricingRule: { threshold: 1000, addend: 100, multiplier: 1.10 },
    },
    {
      code: 'EHP',
      name: 'Electronics Hub - Park Road',
      slug: 'electronics-hub-park',
      contactPhone: '+91-9876543211',
      contactEmail: 'park@ehub.com',
      address: '456 Park Road, Mumbai',
      timezone: 'Asia/Kolkata',
      pricingRule: { threshold: 1000, addend: 100, multiplier: 1.10 },
    },
  ];

  for (const shopDef of defaultShops) {
    let shop = await prisma.shop.findUnique({
      where: { code: shopDef.code },
    });

    if (!shop) {
      console.log(`🏬 Creating shop: ${shopDef.name} (${shopDef.code})`);
      shop = await prisma.shop.create({
        data: shopDef,
      });
      console.log(`✅ Shop created: ${shop.name}`);
    } else {
      console.log(`ℹ️ Shop ${shop.name} (${shopDef.code}) already exists. Preserving existing record.`);
    }

    // Ensure Owner Membership
    const existingMembership = await prisma.shopMembership.findFirst({
      where: {
        userId: owner.id,
        shopId: shop.id,
      },
    });

    if (!existingMembership) {
      await prisma.shopMembership.create({
        data: {
          userId: owner.id,
          shopId: shop.id,
          role: 'OWNER',
        },
      });
      console.log(`✅ Added owner membership for ${shop.name}`);
    }

    // Ensure default Tax Categories exist for the shop
    const defaultTaxCategories = [
      { name: 'GST 18%', rate: 18.0, isDefault: true },
      { name: 'GST 12%', rate: 12.0, isDefault: false },
    ];

    for (const tax of defaultTaxCategories) {
      const existingTax = await prisma.taxCategory.findFirst({
        where: {
          shopId: shop.id,
          name: tax.name,
        },
      });

      if (!existingTax) {
        await prisma.taxCategory.create({
          data: {
            shopId: shop.id,
            name: tax.name,
            rate: tax.rate,
            isDefault: tax.isDefault,
          },
        });
        console.log(`✅ Created default tax category ${tax.name} for ${shop.name}`);
      }
    }
  }

  console.log('🎉 Idempotent database initialization finished successfully.');
}

initProduction()
  .catch((err) => {
    console.error('❌ Database initialization error:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
