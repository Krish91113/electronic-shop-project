import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// ─── Configurable Shop Definitions ───────────────────────────────────────────
// Edit the fallback values below or override via environment variables.
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

async function initProduction() {
  console.log('🚀 Running safe, idempotent database initialization for Time Centre Mobile & Electronics...');

  const isProduction = process.env.NODE_ENV === 'production';

  // Credentials from environment variables
  const shop1OwnerEmail = process.env.INIT_SHOP1_OWNER_EMAIL || 'owner@electronics.com';
  const shop1OwnerPassword = process.env.INIT_SHOP1_OWNER_PASSWORD;
  const shop1OwnerName = process.env.INIT_SHOP1_OWNER_NAME || 'Main Road Branch Owner';

  const shop2OwnerEmail = process.env.INIT_SHOP2_OWNER_EMAIL || 'owner2@electronics.com';
  const shop2OwnerPassword = process.env.INIT_SHOP2_OWNER_PASSWORD;
  const shop2OwnerName = process.env.INIT_SHOP2_OWNER_NAME || 'Akhara Chowk Branch Owner';

  const superOwnerEmail = process.env.INIT_SUPER_OWNER_EMAIL;
  const superOwnerPassword = process.env.INIT_SUPER_OWNER_PASSWORD;
  const superOwnerName = process.env.INIT_SUPER_OWNER_NAME || 'Time Centre Super Owner';

  // Production password safety validation
  if (isProduction) {
    if (!shop1OwnerPassword) {
      console.error('❌ INIT_SHOP1_OWNER_PASSWORD environment variable is required in production.');
      process.exit(1);
    }
    if (!shop2OwnerPassword) {
      console.error('❌ INIT_SHOP2_OWNER_PASSWORD environment variable is required in production.');
      process.exit(1);
    }
    if (superOwnerEmail && !superOwnerPassword) {
      console.error('❌ INIT_SUPER_OWNER_PASSWORD environment variable is required when INIT_SUPER_OWNER_EMAIL is set in production.');
      process.exit(1);
    }
  }

  const effectivePassword1 = shop1OwnerPassword || 'Owner@12345';
  const effectivePassword2 = shop2OwnerPassword || 'Owner@12345';
  const effectiveSuperPassword = superOwnerPassword || 'TimeCentreSuper@123';

  // 1. Create or retrieve Shop 1 Owner
  let owner1 = await prisma.user.findUnique({
    where: { email: shop1OwnerEmail },
  });
  if (!owner1) {
    console.log(`👤 Creating Shop 1 owner: ${shop1OwnerEmail}`);
    const passwordHash = await bcrypt.hash(effectivePassword1, 10);
    owner1 = await prisma.user.create({
      data: {
        email: shop1OwnerEmail,
        name: shop1OwnerName,
        passwordHash,
        role: 'OWNER',
        isActive: true,
      },
    });
    console.log('✅ Shop 1 owner created successfully.');
  } else {
    console.log(`ℹ️ Shop 1 owner (${shop1OwnerEmail}) already exists. Preserving.`);
  }

  // 2. Create or retrieve Shop 2 Owner
  let owner2 = await prisma.user.findUnique({
    where: { email: shop2OwnerEmail },
  });
  if (!owner2) {
    console.log(`👤 Creating Shop 2 owner: ${shop2OwnerEmail}`);
    const passwordHash = await bcrypt.hash(effectivePassword2, 10);
    owner2 = await prisma.user.create({
      data: {
        email: shop2OwnerEmail,
        name: shop2OwnerName,
        passwordHash,
        role: 'OWNER',
        isActive: true,
      },
    });
    console.log('✅ Shop 2 owner created successfully.');
  } else {
    console.log(`ℹ️ Shop 2 owner (${shop2OwnerEmail}) already exists. Preserving.`);
  }

  // 3. Create or retrieve optional Super Owner
  let superOwner = null;
  if (superOwnerEmail) {
    superOwner = await prisma.user.findUnique({
      where: { email: superOwnerEmail },
    });
    if (!superOwner) {
      console.log(`👑 Creating Super Owner: ${superOwnerEmail}`);
      const passwordHash = await bcrypt.hash(effectiveSuperPassword, 10);
      superOwner = await prisma.user.create({
        data: {
          email: superOwnerEmail,
          name: superOwnerName,
          passwordHash,
          role: 'SUPER_OWNER',
          isActive: true,
        },
      });
      console.log('✅ Super owner created successfully.');
    } else {
      console.log(`ℹ️ Super owner (${superOwnerEmail}) already exists. Preserving.`);
    }
  }

  // 4. Create or retrieve Shops and assign independent memberships
  const createdShops = [];
  const owners = [owner1, owner2];

  for (let i = 0; i < SHOPS_CONFIG.length; i++) {
    const shopDef = SHOPS_CONFIG[i];
    const dedicatedOwner = owners[i];

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
      console.log(`ℹ️ Shop ${shop.name} (${shopDef.code}) already exists. Preserving.`);
    }
    createdShops.push(shop);

    // Dedicated Owner Membership: ONLY for this shop
    const existingMembership = await prisma.shopMembership.findFirst({
      where: {
        userId: dedicatedOwner.id,
        shopId: shop.id,
      },
    });

    if (!existingMembership) {
      await prisma.shopMembership.create({
        data: {
          userId: dedicatedOwner.id,
          shopId: shop.id,
          role: 'OWNER',
        },
      });
      console.log(`✅ Added independent owner membership for ${dedicatedOwner.email} in ${shop.name}`);
    }

    // Default Tax Categories
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

    // Default Invoice Sequence
    const currentYear = new Date().getFullYear();
    const existingSeq = await prisma.invoiceSequence.findUnique({
      where: {
        shopId_year: {
          shopId: shop.id,
          year: currentYear,
        },
      },
    });

    if (!existingSeq) {
      await prisma.invoiceSequence.create({
        data: {
          shopId: shop.id,
          year: currentYear,
          lastNumber: 0,
        },
      });
      console.log(`✅ Initialized invoice sequence for ${shop.name} (${currentYear})`);
    }
  }

  // 5. If super owner exists, ensure membership in BOTH shops
  if (superOwner) {
    for (const shop of createdShops) {
      const existingSuperMembership = await prisma.shopMembership.findFirst({
        where: {
          userId: superOwner.id,
          shopId: shop.id,
        },
      });

      if (!existingSuperMembership) {
        await prisma.shopMembership.create({
          data: {
            userId: superOwner.id,
            shopId: shop.id,
            role: 'SUPER_OWNER',
          },
        });
        console.log(`✅ Added super owner membership for ${superOwner.email} in ${shop.name}`);
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
