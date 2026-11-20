import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function maskPii() {
  const dbUrl = process.env.DATABASE_URL || '';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const appEnv = process.env.APP_ENV || 'local';

  // Abort if connected to production host
  if (
    nodeEnv === 'production' ||
    appEnv === 'production' ||
    dbUrl.includes('prod') ||
    process.env.ALLOW_PROD_MUTATION !== 'true'
  ) {
    if (appEnv === 'production') {
      console.error('❌ SAFETY ABORT: Refusing to run mask-pii on a production environment.');
      process.exit(1);
    }
  }

  console.log('🔒 Running mask-pii script on non-production database...');

  await prisma.$transaction(async (tx) => {
    // 1. Mask Sales customer PII
    const sales = await tx.sale.findMany({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    for (let i = 0; i < sales.length; i++) {
      const sale = sales[i];
      const fakePhone = String(9000000000 + i);
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          customerName: `Customer ${i + 1}`,
          customerPhone: fakePhone,
          customerAddress: 'Masked Address, Demo Area',
          customerGstin: null,
          customerAadhaar: null,
          notes: null,
        },
      });
    }
    console.log(`  ✅ Masked ${sales.length} Sales records.`);

    // 2. Mask Users
    const users = await tx.user.findMany({
      select: { id: true, role: true },
      orderBy: { createdAt: 'asc' },
    });
    const devPasswordHash = await bcrypt.hash('devPassword123!', 10);

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      await tx.user.update({
        where: { id: u.id },
        data: {
          email: `user${i + 1}@example.test`,
          name: `Test User ${i + 1}`,
          passwordHash: devPasswordHash,
        },
      });
    }
    console.log(`  ✅ Masked ${users.length} Users (passwords reset to 'devPassword123!').`);

    // 3. Mask Shop owner phone/email, bank account, UPI id (preserve gstin)
    const shops = await tx.shop.findMany({ select: { id: true } });
    for (const s of shops) {
      await tx.shop.update({
        where: { id: s.id },
        data: {
          contactPhone: '9000000000',
          alternatePhone: '9000000001',
          contactEmail: 'shop@example.test',
          bankAccountNo: '0000000000',
          upiId: 'demo@upi',
        },
      });
    }
    console.log(`  ✅ Masked ${shops.length} Shops contact & bank fields.`);

    // 4. Scrub Payment references
    await tx.payment.updateMany({
      data: {
        reference: null,
      },
    });
    console.log('  ✅ Payment references scrubbed.');
  });

  console.log('🎉 PII masking complete.');
}

if (process.argv[1]?.endsWith('mask-pii.js')) {
  maskPii()
    .catch((e) => {
      console.error('❌ Masking failed:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
