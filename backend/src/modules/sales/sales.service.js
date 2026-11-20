import prisma from '../../config/db.js';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errors.js';
import { round2, toMoney, sumMoney } from '../../utils/money.js';
import { parsePagination, paginationMeta } from '../../utils/helpers.js';
import { splitInclusive, addExclusive } from '../../utils/gst.js';
import { amountInWords } from '../../utils/words.js';
import { cleanImei } from '../../utils/imei.js';

/**
 * Generate next invoice number with row-lock.
 * Format: {SHOPCODE}-{YYYY}-{000001}
 */
async function nextInvoiceNumber(tx, shop) {
  const year = new Date().getFullYear();

  // Upsert + row lock via raw SQL for atomicity
  await tx.$executeRaw`
    INSERT INTO "InvoiceSequence" (id, "shopId", year, "lastNumber")
    VALUES (gen_random_uuid(), ${shop.id}, ${year}, 0)
    ON CONFLICT ("shopId", year) DO NOTHING
  `;

  const [seq] = await tx.$queryRaw`
    UPDATE "InvoiceSequence"
    SET "lastNumber" = "lastNumber" + 1
    WHERE "shopId" = ${shop.id} AND year = ${year}
    RETURNING "lastNumber"
  `;

  const num = String(seq.lastNumber).padStart(6, '0');
  return `${shop.code}-${year}-${num}`;
}

export async function createSale(shopId, data, userId) {
  return prisma.$transaction(
    async (tx) => {
      const shop = await tx.shop.findUniqueOrThrow({ where: { id: shopId } });

      const shopStateCode = shop.stateCode || '20';
      const customerStateCode = data.customerStateCode || (data.customerGstin ? data.customerGstin.slice(0, 2) : shopStateCode);
      const isInterState = Boolean(customerStateCode && customerStateCode !== shopStateCode);

      let subtotal = 0;
      let discountTotal = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;

      const saleItemsToCreate = [];
      const stockUnitsToSell = []; // { unit, itemIndex }
      const inventoryDeductions = new Map(); // productId -> qty

      for (const item of data.items) {
        // Fetch product with lock via raw query
        const [product] = await tx.$queryRaw`
          SELECT p.*, tc.rate as "taxRate", tc.name as "taxName"
          FROM "Product" p
          LEFT JOIN "TaxCategory" tc ON p."taxCategoryId" = tc.id
          WHERE p.id = ${item.productId} AND p."shopId" = ${shopId}
          FOR UPDATE OF p
        `;
        if (!product) throw new NotFoundError(`Product ${item.productId} not found`);

        const taxRate = product.taxRate ? Number(product.taxRate) : 0;
        const lineDiscount = round2(item.discountAmount || 0);

        if (product.trackSerial) {
          // Serialized mobile phone or electronic device:
          // Must provide stockUnitIds or imeis
          let unitIds = item.stockUnitIds || [];

          if (item.imeis && item.imeis.length > 0) {
            const cleanedImeis = item.imeis.map(cleanImei);
            const foundByImei = await tx.stockUnit.findMany({
              where: {
                shopId,
                productId: item.productId,
                OR: [{ imei1: { in: cleanedImeis } }, { imei2: { in: cleanedImeis } }],
              },
              select: { id: true, imei1: true, status: true },
            });
            unitIds = foundByImei.map((u) => u.id);
          }

          if (unitIds.length !== item.quantity) {
            throw new BadRequestError(
              `Product "${product.name}" requires exactly ${item.quantity} selected IMEI unit(s) (received ${unitIds.length})`
            );
          }

          // Lock units with row-lock
          const lockedUnits = await tx.$queryRaw`
            SELECT * FROM "StockUnit"
            WHERE id = ANY(${unitIds}) AND "shopId" = ${shopId} AND status = 'IN_STOCK'
            FOR UPDATE
          `;

          if (lockedUnits.length !== unitIds.length) {
            const foundIds = new Set(lockedUnits.map((u) => u.id));
            const unavailable = unitIds.filter((id) => !foundIds.has(id));
            throw new ConflictError(
              `One or more selected units for "${product.name}" are no longer in stock: ${unavailable.join(', ')}`
            );
          }

          // Allocate discount evenly across units
          const unitDiscount = round2(lineDiscount / item.quantity);
          let remainingDiscount = lineDiscount;

          for (let i = 0; i < lockedUnits.length; i++) {
            const unit = lockedUnits[i];
            const isLast = i === lockedUnits.length - 1;
            const thisUnitDiscount = isLast ? remainingDiscount : unitDiscount;
            remainingDiscount = round2(remainingDiscount - thisUnitDiscount);

            const sellingPrice = item.unitSellingPrice;
            const split = splitInclusive(sellingPrice, 1, thisUnitDiscount, taxRate, { isInterState });

            subtotal += split.taxable;
            cgstTotal += split.cgst;
            sgstTotal += split.sgst;
            igstTotal += split.igst;
            discountTotal += thisUnitDiscount;

            const saleItemIndex = saleItemsToCreate.length;
            saleItemsToCreate.push({
              productId: item.productId,
              stockUnitId: unit.id,
              productNameSnapshot: product.name,
              barcodeSnapshot: product.barcode || unit.imei1 || null,
              imeiSnapshot: unit.imei1,
              imei2Snapshot: unit.imei2 || null,
              chargerNoSnapshot: unit.chargerNo || null,
              hsnSnapshot: product.hsnCode || '8517',
              variantSnapshot: product.variant || null,
              colorSnapshot: product.color || null,
              quantity: 1,
              unitSellingPrice: sellingPrice,
              unitBasePrice: split.unitBasePrice,
              taxableValue: split.taxable,
              discountAmount: thisUnitDiscount,
              taxCategorySnapshot: product.taxName || null,
              taxRateSnapshot: taxRate,
              taxAmount: split.tax,
              cgstAmount: split.cgst,
              sgstAmount: split.sgst,
              igstAmount: split.igst,
              serialNumber: unit.serialNumber || unit.imei1,
              unitCostSnapshot: Number(unit.purchaseCost),
              lineTotal: split.gross,
            });

            stockUnitsToSell.push({ unit, saleItemIndex });
          }

          const currentDeduction = inventoryDeductions.get(item.productId) || 0;
          inventoryDeductions.set(item.productId, currentDeduction + item.quantity);
        } else {
          // Non-serialized item (chargers, cables, covers, etc.)
          const [inv] = await tx.$queryRaw`
            SELECT * FROM "Inventory"
            WHERE "shopId" = ${shopId} AND "productId" = ${item.productId}
            FOR UPDATE
          `;
          if (!inv) throw new NotFoundError(`Inventory not found for product ${item.productId}`);
          if (inv.quantity < item.quantity) {
            throw new ConflictError(
              `Insufficient stock for "${product.name}": available ${inv.quantity}, requested ${item.quantity}`
            );
          }

          const split = splitInclusive(item.unitSellingPrice, item.quantity, lineDiscount, taxRate, { isInterState });

          subtotal += split.taxable;
          cgstTotal += split.cgst;
          sgstTotal += split.sgst;
          igstTotal += split.igst;
          discountTotal += lineDiscount;

          saleItemsToCreate.push({
            productId: item.productId,
            stockUnitId: null,
            productNameSnapshot: product.name,
            barcodeSnapshot: product.barcode || null,
            imeiSnapshot: null,
            imei2Snapshot: null,
            chargerNoSnapshot: null,
            hsnSnapshot: product.hsnCode || null,
            variantSnapshot: product.variant || null,
            colorSnapshot: product.color || null,
            quantity: item.quantity,
            unitSellingPrice: item.unitSellingPrice,
            unitBasePrice: split.unitBasePrice,
            taxableValue: split.taxable,
            discountAmount: lineDiscount,
            taxCategorySnapshot: product.taxName || null,
            taxRateSnapshot: taxRate,
            taxAmount: split.tax,
            cgstAmount: split.cgst,
            sgstAmount: split.sgst,
            igstAmount: split.igst,
            serialNumber: item.serialNumber || null,
            unitCostSnapshot: Number(product.purchaseCost),
            lineTotal: split.gross,
          });

          const currentDeduction = inventoryDeductions.get(item.productId) || 0;
          inventoryDeductions.set(item.productId, currentDeduction + item.quantity);
        }
      }

      // Deduct inventory quantities
      for (const [prodId, qty] of inventoryDeductions.entries()) {
        await tx.$executeRaw`
          UPDATE "Inventory"
          SET quantity = quantity - ${qty}, "updatedAt" = NOW()
          WHERE "shopId" = ${shopId} AND "productId" = ${prodId}
            AND quantity >= ${qty}
        `;
      }

      subtotal = round2(subtotal);
      discountTotal = round2(discountTotal);
      cgstTotal = round2(cgstTotal);
      sgstTotal = round2(sgstTotal);
      igstTotal = round2(igstTotal);
      const taxTotal = round2(cgstTotal + sgstTotal + igstTotal);
      const totalAmount = round2(subtotal + taxTotal);
      const roundOff = round2(Math.round(totalAmount) - totalAmount);
      const words = amountInWords(totalAmount);

      const invoiceNumber = await nextInvoiceNumber(tx, shop);

      // Create Sale with items
      const sale = await tx.sale.create({
        data: {
          shopId,
          invoiceNumber,
          status: 'COMPLETED',
          subtotal,
          discountTotal,
          taxTotal,
          totalAmount,
          cgstTotal,
          sgstTotal,
          igstTotal,
          amountInWords: words,
          roundOff,
          taxInclusive: true,
          paymentStatus: 'PAID',
          customerName: data.customerName || null,
          customerPhone: data.customerPhone || null,
          customerAddress: data.customerAddress || null,
          customerGstin: data.customerGstin || null,
          customerAadhaar: data.customerAadhaar || null,
          customerState: data.customerState || shop.state || 'Jharkhand',
          customerStateCode: customerStateCode,
          placeOfSupply: data.placeOfSupply || shop.state || 'Jharkhand',
          paymentMode: data.paymentMode || data.paymentMethod,
          notes: data.notes || null,
          createdBy: userId,
          completedAt: new Date(),
          items: { create: saleItemsToCreate },
        },
        include: { items: true },
      });

      // Link StockUnits and create StockMovements with referenceId = sale.id directly
      for (const { unit, saleItemIndex } of stockUnitsToSell) {
        const createdItem = sale.items[saleItemIndex];
        await tx.stockUnit.update({
          where: { id: unit.id },
          data: {
            status: 'SOLD',
            soldAt: new Date(),
            saleItemId: createdItem.id,
          },
        });

        await tx.stockMovement.create({
          data: {
            shopId,
            productId: unit.productId,
            stockUnitId: unit.id,
            movementType: 'SALE',
            quantityDelta: -1,
            unitCost: unit.purchaseCost,
            referenceType: 'SALE',
            referenceId: sale.id,
            notes: `Sold on invoice ${sale.invoiceNumber} (IMEI ${unit.imei1})`,
            createdBy: userId,
          },
        });
      }

      // Non-serialized stock movements
      for (const item of sale.items) {
        if (!item.stockUnitId) {
          await tx.stockMovement.create({
            data: {
              shopId,
              productId: item.productId,
              movementType: 'SALE',
              quantityDelta: -item.quantity,
              unitCost: item.unitCostSnapshot,
              referenceType: 'SALE',
              referenceId: sale.id,
              notes: `Sold on invoice ${sale.invoiceNumber}`,
              createdBy: userId,
            },
          });
        }
      }

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          shopId,
          saleId: sale.id,
          method: data.paymentMethod,
          amount: totalAmount,
          status: 'SUCCESS',
          reference: data.paymentReference || null,
        },
      });

      return { ...sale, payments: [payment] };
    },
    { maxWait: 30000, timeout: 60000 }
  );
}

export async function getSale(shopId, saleId) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, shopId },
    include: {
      items: {
        include: {
          product: {
            select: { warranty: true, category: true, trackSerial: true },
          },
          stockUnit: true,
        },
      },
      payments: true,
      shop: {
        select: {
          name: true,
          code: true,
          contactPhone: true,
          alternatePhone: true,
          contactEmail: true,
          address: true,
          state: true,
          stateCode: true,
          gstin: true,
          logoUrl: true,
          invoiceFooter: true,
          bankName: true,
          bankAccountNo: true,
          bankIfsc: true,
          bankBranch: true,
          upiId: true,
          termsAndConditions: true,
          brandsServiced: true,
          tagline: true,
          warrantyNote: true,
          pricesIncludeTax: true,
        },
      },
    },
  });
  if (!sale) throw new NotFoundError('Sale not found');

  return enrichSaleForInvoice(sale);
}

export async function listSales(shopId, query) {
  const { page, limit, skip } = parsePagination(query);
  const where = { shopId };
  if (query.status) where.status = query.status;
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to) where.createdAt.lte = new Date(query.to);
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: { items: true, payments: true },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sale.count({ where }),
  ]);

  return { sales, pagination: paginationMeta(total, page, limit) };
}

export async function getInvoice(shopId, saleId) {
  return getSale(shopId, saleId);
}

/**
 * Backward compatibility helper for invoices:
 * Ensures old invoices (pre-migration) populate CGST/SGST, amountInWords, roundOff,
 * and fall back to serialNumber / 8517 for phones cleanly.
 */
function enrichSaleForInvoice(sale) {
  const taxTotal = Number(sale.taxTotal || 0);
  let cgstTotal = Number(sale.cgstTotal || 0);
  let sgstTotal = Number(sale.sgstTotal || 0);
  let igstTotal = Number(sale.igstTotal || 0);

  // Derive CGST/SGST for legacy sales
  if (cgstTotal === 0 && sgstTotal === 0 && igstTotal === 0 && taxTotal > 0) {
    cgstTotal = round2(taxTotal / 2);
    sgstTotal = round2(taxTotal - cgstTotal);
  }

  const totalAmount = Number(sale.totalAmount || 0);
  const words = sale.amountInWords || amountInWords(totalAmount);
  const roundOff = sale.roundOff !== null && sale.roundOff !== undefined ? Number(sale.roundOff) : round2(Math.round(totalAmount) - totalAmount);

  const enrichedItems = sale.items.map((item) => {
    const isPhone = item.product?.trackSerial || (item.product?.category && /phone|mobile/i.test(item.product.category));
    const imei = item.imeiSnapshot || item.stockUnit?.imei1 || item.serialNumber || null;
    const hsn = item.hsnSnapshot || (isPhone ? '8517' : null);

    const unitBase = item.unitBasePrice !== null && item.unitBasePrice !== undefined
      ? Number(item.unitBasePrice)
      : (sale.taxInclusive && item.taxRateSnapshot
          ? round2(Number(item.unitSellingPrice) / (1 + Number(item.taxRateSnapshot) / 100))
          : Number(item.unitSellingPrice));

    const taxable = item.taxableValue !== null && item.taxableValue !== undefined
      ? Number(item.taxableValue)
      : round2(unitBase * item.quantity - Number(item.discountAmount || 0));

    let itemCgst = item.cgstAmount !== null && item.cgstAmount !== undefined ? Number(item.cgstAmount) : 0;
    let itemSgst = item.sgstAmount !== null && item.sgstAmount !== undefined ? Number(item.sgstAmount) : 0;
    let itemIgst = item.igstAmount !== null && item.igstAmount !== undefined ? Number(item.igstAmount) : 0;

    if (itemCgst === 0 && itemSgst === 0 && itemIgst === 0 && Number(item.taxAmount || 0) > 0) {
      itemCgst = round2(Number(item.taxAmount) / 2);
      itemSgst = round2(Number(item.taxAmount) - itemCgst);
    }

    return {
      ...item,
      imeiSnapshot: imei,
      hsnSnapshot: hsn,
      unitBasePrice: unitBase,
      taxableValue: taxable,
      cgstAmount: itemCgst,
      sgstAmount: itemSgst,
      igstAmount: itemIgst,
    };
  });

  return {
    ...sale,
    cgstTotal,
    sgstTotal,
    igstTotal,
    amountInWords: words,
    roundOff,
    items: enrichedItems,
  };
}

export async function cancelSale(shopId, saleId, userId) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, shopId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundError('Sale not found');
    if (sale.status === 'CANCELLED') throw new ConflictError('Sale already cancelled');

    // Reverse stock movements & restore units
    for (const item of sale.items) {
      if (item.stockUnitId) {
        await tx.stockUnit.update({
          where: { id: item.stockUnitId },
          data: { status: 'IN_STOCK', soldAt: null, saleItemId: null },
        });

        await tx.stockMovement.create({
          data: {
            shopId,
            productId: item.productId,
            stockUnitId: item.stockUnitId,
            movementType: 'RETURN',
            quantityDelta: item.quantity,
            unitCost: item.unitCostSnapshot,
            referenceType: 'CANCELLATION',
            referenceId: saleId,
            notes: `Cancellation of sale ${sale.invoiceNumber} (IMEI restored)`,
            createdBy: userId,
          },
        });
      } else {
        await tx.stockMovement.create({
          data: {
            shopId,
            productId: item.productId,
            movementType: 'RETURN',
            quantityDelta: item.quantity,
            unitCost: item.unitCostSnapshot,
            referenceType: 'CANCELLATION',
            referenceId: saleId,
            notes: `Cancellation of sale ${sale.invoiceNumber}`,
            createdBy: userId,
          },
        });
      }

      await tx.inventory.update({
        where: { shopId_productId: { shopId, productId: item.productId } },
        data: { quantity: { increment: item.quantity } },
      });
    }

    // Update sale status
    const updated = await tx.sale.update({
      where: { id: saleId },
      data: { status: 'CANCELLED', paymentStatus: 'REFUNDED' },
      include: { items: true, payments: true },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        shopId,
        userId,
        action: 'SALE_CANCELLATION',
        entityType: 'Sale',
        entityId: saleId,
        details: { invoiceNumber: sale.invoiceNumber },
      },
    });

    return updated;
  });
}

export async function returnSaleItems(shopId, saleId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, shopId, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } },
      include: { items: true },
    });
    if (!sale) throw new NotFoundError('Eligible sale not found');

    let refundAmount = 0;

    for (const returnItem of data.items) {
      const saleItem = sale.items.find((si) => si.id === returnItem.saleItemId);
      if (!saleItem) throw new NotFoundError(`Sale item ${returnItem.saleItemId} not found`);

      const alreadyReturned = saleItem.returnedQuantity || 0;
      if (returnItem.quantity + alreadyReturned > saleItem.quantity) {
        throw new BadRequestError(`Return quantity exceeds remaining sold quantity for line item`);
      }

      // Restore stock unit if serialized
      if (saleItem.stockUnitId) {
        await tx.stockUnit.update({
          where: { id: saleItem.stockUnitId },
          data: { status: 'IN_STOCK', soldAt: null, saleItemId: null },
        });

        await tx.stockMovement.create({
          data: {
            shopId,
            productId: saleItem.productId,
            stockUnitId: saleItem.stockUnitId,
            movementType: 'RETURN',
            quantityDelta: returnItem.quantity,
            unitCost: saleItem.unitCostSnapshot,
            referenceType: 'RETURN',
            referenceId: saleId,
            notes: returnItem.reason || `Return of IMEI ${saleItem.imeiSnapshot || ''} from ${sale.invoiceNumber}`,
            createdBy: userId,
          },
        });
      } else {
        await tx.stockMovement.create({
          data: {
            shopId,
            productId: saleItem.productId,
            movementType: 'RETURN',
            quantityDelta: returnItem.quantity,
            unitCost: saleItem.unitCostSnapshot,
            referenceType: 'RETURN',
            referenceId: saleId,
            notes: returnItem.reason || `Return from sale ${sale.invoiceNumber}`,
            createdBy: userId,
          },
        });
      }

      // Restore inventory quantity
      await tx.inventory.update({
        where: { shopId_productId: { shopId, productId: saleItem.productId } },
        data: { quantity: { increment: returnItem.quantity } },
      });

      // Update returnedQuantity
      await tx.saleItem.update({
        where: { id: saleItem.id },
        data: { returnedQuantity: { increment: returnItem.quantity } },
      });

      const pricePerUnit = round2(Number(saleItem.lineTotal) / saleItem.quantity);
      refundAmount += round2(pricePerUnit * returnItem.quantity);
    }

    refundAmount = round2(refundAmount);

    // Determine if all items in sale are now returned
    const refreshedItems = await tx.saleItem.findMany({ where: { saleId } });
    const isFullyReturned = refreshedItems.every((si) => si.returnedQuantity >= si.quantity);
    const newStatus = isFullyReturned ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    await tx.sale.update({
      where: { id: saleId },
      data: { status: newStatus },
    });

    await tx.auditLog.create({
      data: {
        shopId,
        userId,
        action: 'SALE_RETURN',
        entityType: 'Sale',
        entityId: saleId,
        details: { returnedItems: data.items, refundAmount, status: newStatus },
      },
    });

    return { saleId, refundAmount, status: newStatus };
  });
}
