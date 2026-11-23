import { PrismaClient } from '@prisma/client';
import { computeModelKey, parseProductModel } from '../../src/utils/modelKey.js';
import { validateImei } from '../../src/utils/imei.js';

const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');

export async function mergeProductsIntoModels({ dryRun = isDryRun, shopId = null } = {}) {
  console.log(`\n🔄 Starting merge-products-into-models script [Mode: ${dryRun ? 'DRY-RUN' : 'LIVE EXECUTION'}]...`);

  const report = {
    shopsProcessed: 0,
    groupsFound: 0,
    productsMerged: 0,
    canonicalProductsUpdated: 0,
    stockUnitsCreated: 0,
    manualReviewRequired: [],
  };

  const shops = await prisma.shop.findMany({
    where: shopId ? { id: shopId } : {},
    select: { id: true, name: true, code: true },
  });

  for (const shop of shops) {
    report.shopsProcessed++;
    console.log(`\n🏢 Processing Shop: ${shop.name} (${shop.code})`);

    const products = await prisma.product.findMany({
      where: { shopId: shop.id },
      include: {
        inventory: true,
        saleItems: true,
        stockMovements: true,
        images: true,
        stockUnits: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group products by computed modelKey
    const groups = new Map();

    for (const p of products) {
      const parsed = parseProductModel(p.name);
      const brand = p.brand || parsed.brand;
      const model = p.model || parsed.model;
      const variant = p.variant || parsed.variant;
      const color = p.color || parsed.color;

      const modelKey = computeModelKey({ brand, model, variant, color, name: p.name });

      if (!groups.has(modelKey)) {
        groups.set(modelKey, []);
      }
      groups.get(modelKey).push({
        product: p,
        parsed: { brand, model, variant, color },
        modelKey,
      });
    }

    report.groupsFound += groups.size;

    for (const [modelKey, items] of groups.entries()) {
      if (items.length === 1 && items[0].product.modelKey === modelKey) {
        // Already canonical and alone
        continue;
      }

      // Pick canonical product: one with sales history or oldest
      items.sort((a, b) => {
        const salesA = a.product.saleItems.length;
        const salesB = b.product.saleItems.length;
        if (salesA !== salesB) return salesB - salesA;
        return new Date(a.product.createdAt) - new Date(b.product.createdAt);
      });

      const canonicalItem = items[0];
      const canonicalProduct = canonicalItem.product;
      const duplicates = items.slice(1);

      console.log(`\n  📦 Model Group: [${modelKey}]`);
      console.log(`     Canonical Product: "${canonicalProduct.name}" (ID: ${canonicalProduct.id})`);
      if (duplicates.length > 0) {
        console.log(`     Duplicates to merge: ${duplicates.length}`);
      }

      const actions = async (tx) => {
        // 1. Update canonical product with normalized fields and trackSerial flag
        const isPhone = (canonicalItem.parsed.brand || canonicalProduct.category === 'Phones' || canonicalProduct.category === 'Mobile');
        const trackSerial = canonicalProduct.trackSerial || Boolean(isPhone || canonicalProduct.barcode?.length === 15);

        if (!dryRun) {
          await tx.product.update({
            where: { id: canonicalProduct.id },
            data: {
              brand: canonicalItem.parsed.brand || canonicalProduct.brand,
              model: canonicalItem.parsed.model || canonicalProduct.model,
              variant: canonicalItem.parsed.variant || canonicalProduct.variant,
              color: canonicalItem.parsed.color || canonicalProduct.color,
              modelKey,
              trackSerial,
              hsnCode: canonicalProduct.hsnCode || (trackSerial ? '8517' : canonicalProduct.hsnCode),
            },
          });
        }
        report.canonicalProductsUpdated++;

        // 2. Process canonical product's barcode if it is a 15-digit IMEI
        const canonicalQty = canonicalProduct.inventory?.quantity || 0;
        if (canonicalProduct.barcode && canonicalProduct.barcode.length === 15) {
          const valRes = validateImei(canonicalProduct.barcode, { allowLuhnOverride: true });
          if (valRes.valid) {
            const existingUnit = await tx.stockUnit.findFirst({
              where: { shopId: shop.id, imei1: valRes.cleaned },
            });
            if (!existingUnit && canonicalQty > 0) {
              if (!dryRun) {
                await tx.stockUnit.create({
                  data: {
                    shopId: shop.id,
                    productId: canonicalProduct.id,
                    imei1: valRes.cleaned,
                    purchaseCost: canonicalProduct.purchaseCost,
                    status: 'IN_STOCK',
                  },
                });
              }
              report.stockUnitsCreated++;
              console.log(`     + Created StockUnit from canonical barcode: ${valRes.cleaned}`);
            }
          }
        }

        // 3. Merge duplicates
        for (const dupItem of duplicates) {
          const dup = dupItem.product;
          const dupQty = dup.inventory?.quantity || 0;

          // Re-link SaleItems
          if (dup.saleItems.length > 0) {
            console.log(`     -> Moving ${dup.saleItems.length} SaleItems from ${dup.id} to canonical`);
            if (!dryRun) {
              await tx.saleItem.updateMany({
                where: { productId: dup.id },
                data: { productId: canonicalProduct.id },
              });
            }
          }

          // Re-link StockMovements
          if (dup.stockMovements.length > 0) {
            console.log(`     -> Moving ${dup.stockMovements.length} StockMovements from ${dup.id} to canonical`);
            if (!dryRun) {
              await tx.stockMovement.updateMany({
                where: { productId: dup.id },
                data: { productId: canonicalProduct.id },
              });
            }
          }

          // Re-link ProductImages
          if (dup.images.length > 0) {
            if (!dryRun) {
              await tx.productImage.updateMany({
                where: { productId: dup.id },
                data: { productId: canonicalProduct.id },
              });
            }
          }

          // Convert duplicate IMEI to StockUnit
          if (dup.barcode && dup.barcode.length === 15) {
            const valRes = validateImei(dup.barcode, { allowLuhnOverride: true });
            if (valRes.valid) {
              const existingUnit = await tx.stockUnit.findFirst({
                where: { shopId: shop.id, imei1: valRes.cleaned },
              });

              if (!existingUnit) {
                // If it had a sale item or qty is 0, mark SOLD or IN_STOCK
                const status = dupQty > 0 ? 'IN_STOCK' : 'SOLD';
                if (!dryRun) {
                  await tx.stockUnit.create({
                    data: {
                      shopId: shop.id,
                      productId: canonicalProduct.id,
                      imei1: valRes.cleaned,
                      purchaseCost: dup.purchaseCost,
                      sellingPrice: dup.defaultSellingPrice,
                      status,
                      notes: `Migrated from duplicate product ${dup.id} ("${dup.name}")`,
                    },
                  });
                }
                report.stockUnitsCreated++;
                console.log(`     + Created StockUnit for duplicate: IMEI ${valRes.cleaned} (${status})`);
              }
            }
          } else if (dupQty > 1) {
            report.manualReviewRequired.push({
              shop: shop.name,
              product: dup.name,
              barcode: dup.barcode,
              quantity: dupQty,
              reason: 'Multiple quantity with non-15-digit barcode; manual IMEI entry required',
            });
          }

          // Remove duplicate inventory row
          if (!dryRun) {
            await tx.inventory.deleteMany({
              where: { productId: dup.id },
            });
            // Soft delete or deactivate duplicate product
            await tx.product.update({
              where: { id: dup.id },
              data: {
                isActive: false,
                isPublished: false,
                barcode: dup.barcode ? `${dup.barcode}_archived_${Date.now()}` : null,
                slug: `${dup.slug}-archived-${Date.now()}`,
                modelKey: null,
              },
            });
          }
          report.productsMerged++;
        }

        // 4. Reconcile inventory quantity for canonical product
        const unitsInStockCount = await tx.stockUnit.count({
          where: { productId: canonicalProduct.id, status: 'IN_STOCK' },
        });

        if (trackSerial && unitsInStockCount > 0) {
          if (!dryRun) {
            await tx.inventory.upsert({
              where: { shopId_productId: { shopId: shop.id, productId: canonicalProduct.id } },
              create: { shopId: shop.id, productId: canonicalProduct.id, quantity: unitsInStockCount },
              update: { quantity: unitsInStockCount },
            });
          }
        }

        // Audit log entry
        if (!dryRun) {
          await tx.auditLog.create({
            data: {
              shopId: shop.id,
              action: 'MERGE_PRODUCTS_TO_MODEL',
              entityType: 'Product',
              entityId: canonicalProduct.id,
              details: {
                modelKey,
                duplicatesMerged: duplicates.map((d) => d.product.id),
                unitsCreated: report.stockUnitsCreated,
              },
            },
          });
        }
      };

      if (dryRun) {
        await actions(prisma);
      } else {
        await prisma.$transaction(actions);
      }
    }
  }

  console.log('\n================ MERGE REPORT ================');
  console.log(`Shops processed:             ${report.shopsProcessed}`);
  console.log(`Model groups found:          ${report.groupsFound}`);
  console.log(`Canonical products updated:  ${report.canonicalProductsUpdated}`);
  console.log(`Duplicates merged & retired: ${report.productsMerged}`);
  console.log(`Stock units created:         ${report.stockUnitsCreated}`);
  if (report.manualReviewRequired.length > 0) {
    console.log(`\n⚠️  Manual Review Required (${report.manualReviewRequired.length} items):`);
    report.manualReviewRequired.forEach((r, idx) => {
      console.log(`   ${idx + 1}. [${r.shop}] ${r.product} (Qty: ${r.quantity}): ${r.reason}`);
    });
  } else {
    console.log('No manual review flags.');
  }
  console.log('==============================================\n');

  return report;
}

if (process.argv[1]?.endsWith('merge-products-into-models.js')) {
  mergeProductsIntoModels()
    .catch((e) => {
      console.error('❌ Script failed:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

