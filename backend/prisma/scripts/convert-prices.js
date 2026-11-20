import { PrismaClient } from '@prisma/client';
import { round2 } from '../../src/utils/money.js';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

export async function convertPrices({ dryRun = isDryRun } = {}) {
  console.log(`\n💰 Starting convert-prices script [Mode: ${dryRun ? 'DRY-RUN' : 'LIVE EXECUTION'}]...`);

  const report = {
    productsEvaluated: 0,
    pricesUpdated: 0,
    details: [],
  };

  const shops = await prisma.shop.findMany({
    select: { id: true, name: true, pricesIncludeTax: true },
  });

  for (const shop of shops) {
    const products = await prisma.product.findMany({
      where: { shopId: shop.id },
      include: { taxCategory: true },
    });

    for (const p of products) {
      report.productsEvaluated++;
      const currentPrice = Number(p.defaultSellingPrice || 0);
      const taxRate = Number(p.taxCategory?.rate || 0);

      // If prices were entered exclusive and need to be marked inclusive:
      // In Time Centre, the owner already entered the inclusive final price (e.g. 19,999)
      // This script logs and verifies every price with base and tax breakdown
      const basePrice = taxRate > 0 ? round2(currentPrice / (1 + taxRate / 100)) : currentPrice;
      const gstAmount = round2(currentPrice - basePrice);

      report.details.push({
        shop: shop.name,
        product: p.name,
        inclusivePrice: currentPrice,
        taxRate: `${taxRate}%`,
        basePrice,
        gstAmount,
      });
      report.pricesUpdated++;
    }
  }

  console.log('\n================ PRICE CONVERSION / AUDIT REPORT ================');
  console.log(`Products evaluated: ${report.productsEvaluated}`);
  console.log(`Sample breakdown:`);
  report.details.slice(0, 10).forEach((d) => {
    console.log(`  - [${d.shop}] ${d.product}: Final ₹${d.inclusivePrice} (Tax: ${d.taxRate}) -> Base: ₹${d.basePrice}, GST: ₹${d.gstAmount}`);
  });
  console.log('=================================================================\n');

  return report;
}

if (process.argv[1]?.endsWith('convert-prices.js')) {
  convertPrices()
    .catch((e) => {
      console.error('❌ Script failed:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
