import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

let prisma = new PrismaClient();

async function runVerification() {
  console.log('🧪 Starting database integration verification...');

  // 1. Connectivity test
  const shop = await prisma.shop.findFirst({
    where: { code: 'EHM' },
    include: { taxCategories: true },
  });

  if (!shop) {
    throw new Error('Shop EHM not found. Please run npm run prisma:init:prod first.');
  }
  console.log(`✅ Connected to database. Verified shop exists: ${shop.name} (${shop.id})`);

  const taxCat = shop.taxCategories[0] || null;
  const testBarcode = `TEST-${Date.now()}`;
  const testSlug = `integration-test-item-${Date.now()}`;
  const testInvoice = `INV-TEST-${Date.now()}`;

  let createdProduct = null;
  let createdSale = null;

  try {
    // 2. Create Product
    console.log(`📦 Creating test product with barcode ${testBarcode}...`);
    createdProduct = await prisma.product.create({
      data: {
        shopId: shop.id,
        name: 'Verification Test Cable',
        slug: testSlug,
        barcode: testBarcode,
        brand: 'TestBrand',
        model: 'V-100',
        purchaseCost: 150.00,
        defaultSellingPrice: 299.00,
        taxCategoryId: taxCat ? taxCat.id : null,
      },
    });
    console.log(`✅ Product created: ID ${createdProduct.id}`);

    // 3. Receive Stock (Initial Inventory & StockMovement)
    console.log('📥 Recording stock movement (receiving 25 units)...');
    await prisma.$transaction([
      prisma.inventory.upsert({
        where: { productId: createdProduct.id },
        create: {
          shopId: shop.id,
          productId: createdProduct.id,
          quantity: 25,
        },
        update: {
          quantity: { increment: 25 },
        },
      }),
      prisma.stockMovement.create({
        data: {
          shopId: shop.id,
          productId: createdProduct.id,
          movementType: 'PURCHASE',
          quantityDelta: 25,
          unitCost: 150.00,
          notes: 'Integration test stock arrival',
        },
      }),
    ]);
    console.log('✅ Stock received and inventory set to 25.');

    // 4. Record a Sale (deducting 3 units from inventory)
    console.log('💳 Recording sale of 3 units...');
    createdSale = await prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.update({
        where: { productId: createdProduct.id },
        data: { quantity: { decrement: 3 } },
      });

      await tx.stockMovement.create({
        data: {
          shopId: shop.id,
          productId: createdProduct.id,
          movementType: 'SALE',
          quantityDelta: -3,
          unitCost: 150.00,
          notes: `Sold via invoice ${testInvoice}`,
        },
      });

      const sale = await tx.sale.create({
        data: {
          shopId: shop.id,
          invoiceNumber: testInvoice,
          status: 'COMPLETED',
          subtotal: 897.00,
          taxTotal: 0.00,
          discountTotal: 0.00,
          totalAmount: 897.00,
          paymentStatus: 'PAID',
          items: {
            create: {
              productId: createdProduct.id,
              productNameSnapshot: createdProduct.name,
              barcodeSnapshot: createdProduct.barcode,
              quantity: 3,
              unitSellingPrice: 299.00,
              unitCostSnapshot: 150.00,
              lineTotal: 897.00,
            },
          },
          payments: {
            create: {
              shopId: shop.id,
              method: 'CASH',
              amount: 897.00,
              status: 'SUCCESS',
            },
          },
        },
      });

      return sale;
    });
    console.log(`✅ Sale recorded: Invoice ${createdSale.invoiceNumber}`);

    // 5. Simulate Disconnection & Reconnection
    console.log('🔄 Disconnecting client to verify persistence across sessions...');
    await prisma.$disconnect();

    // Re-instantiate PrismaClient
    prisma = new PrismaClient();

    // 6. Verify Persistence after Reconnect
    console.log('🔍 Reconnecting and verifying persisted records...');
    const persistedProduct = await prisma.product.findUnique({
      where: { id: createdProduct.id },
      include: { inventory: true },
    });
    const persistedSale = await prisma.sale.findUnique({
      where: { invoiceNumber: testInvoice },
      include: { items: true, payments: true },
    });

    if (!persistedProduct || !persistedProduct.inventory) {
      throw new Error('Verification failed: Product or inventory not found after reconnecting.');
    }
    if (persistedProduct.inventory.quantity !== 22) {
      throw new Error(`Verification failed: Expected inventory 22, got ${persistedProduct.inventory.quantity}`);
    }
    if (!persistedSale || persistedSale.items.length !== 1) {
      throw new Error('Verification failed: Sale not found or items mismatch after reconnecting.');
    }

    console.log(`✅ Verified persistence: Remaining inventory is ${persistedProduct.inventory.quantity} (25 - 3 = 22)`);
    console.log(`✅ Verified sale persistence: Invoice ${persistedSale.invoiceNumber} with total ₹${persistedSale.totalAmount}`);
  } finally {
    // 7. Clean up test records (safe, targeted cleanup of only this test run)
    if (createdSale) {
      await prisma.payment.deleteMany({ where: { saleId: createdSale.id } });
      await prisma.saleItem.deleteMany({ where: { saleId: createdSale.id } });
      await prisma.sale.delete({ where: { id: createdSale.id } }).catch(() => {});
    }
    if (createdProduct) {
      await prisma.stockMovement.deleteMany({ where: { productId: createdProduct.id } });
      await prisma.inventory.deleteMany({ where: { productId: createdProduct.id } });
      await prisma.product.delete({ where: { id: createdProduct.id } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log('🧹 Cleaned up test records. Database returned to pristine state.');
  }

  console.log('🎯 ALL INTEGRATION CHECKS PASSED SUCCESSFULLY!');
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
