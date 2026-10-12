import prisma from '../../config/db.js';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errors.js';
import { round2, toMoney, sumMoney } from '../../utils/money.js';
import { parsePagination, paginationMeta } from '../../utils/helpers.js';

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

    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    const saleItems = [];

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

      // Check and deduct stock atomically
      const [inv] = await tx.$queryRaw`
        SELECT * FROM "Inventory"
        WHERE "shopId" = ${shopId} AND "productId" = ${item.productId}
        FOR UPDATE
      `;
      if (!inv) throw new NotFoundError(`Inventory not found for product ${item.productId}`);
      if (inv.quantity < item.quantity) {
        throw new ConflictError(
          `Insufficient stock for ${product.name}: available ${inv.quantity}, requested ${item.quantity}`
        );
      }

      // Deduct stock
      await tx.$executeRaw`
        UPDATE "Inventory"
        SET quantity = quantity - ${item.quantity}, "updatedAt" = NOW()
        WHERE "shopId" = ${shopId} AND "productId" = ${item.productId}
          AND quantity >= ${item.quantity}
      `;

      const taxRate = product.taxRate ? Number(product.taxRate) : 0;
      const lineSubtotal = round2(item.unitSellingPrice * item.quantity);
      const lineDiscount = round2(item.discountAmount || 0);
      const taxableAmount = round2(lineSubtotal - lineDiscount);
      const lineTax = round2(taxableAmount * taxRate / 100);
      const lineTotal = round2(taxableAmount + lineTax);

      subtotal += lineSubtotal;
      discountTotal += lineDiscount;
      taxTotal += lineTax;

      saleItems.push({
        productId: item.productId,
        productNameSnapshot: product.name,
        barcodeSnapshot: product.barcode || null,
        quantity: item.quantity,
        unitSellingPrice: item.unitSellingPrice,
        discountAmount: lineDiscount,
        taxCategorySnapshot: product.taxName || null,
        taxRateSnapshot: taxRate,
        taxAmount: lineTax,
        serialNumber: item.serialNumber || null,
        unitCostSnapshot: Number(product.purchaseCost),
        lineTotal,
      });

      // Stock movement for sale
      await tx.stockMovement.create({
        data: {
          shopId,
          productId: item.productId,
          movementType: 'SALE',
          quantityDelta: -item.quantity,
          unitCost: product.purchaseCost,
          referenceType: 'SALE',
          createdBy: userId,
        },
      });
    }

    subtotal = round2(subtotal);
    discountTotal = round2(discountTotal);
    taxTotal = round2(taxTotal);
    const totalAmount = round2(subtotal - discountTotal + taxTotal);

    const invoiceNumber = await nextInvoiceNumber(tx, shop);

    const sale = await tx.sale.create({
      data: {
        shopId,
        invoiceNumber,
        status: 'COMPLETED',
        subtotal,
        discountTotal,
        taxTotal,
        totalAmount,
        paymentStatus: 'PAID',
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        notes: data.notes || null,
        createdBy: userId,
        completedAt: new Date(),
        items: { create: saleItems },
      },
      include: { items: true },
    });

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

    // Update referenceId on stock movements
    for (const si of sale.items) {
      await tx.stockMovement.updateMany({
        where: {
          shopId,
          productId: si.productId,
          referenceType: 'SALE',
          referenceId: null,
          createdBy: userId,
        },
        data: { referenceId: sale.id },
      });
    }

    return { ...sale, payments: [payment] };
  }, { maxWait: 30000, timeout: 60000 });
}

export async function getSale(shopId, saleId) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, shopId },
    include: {
      items: {
        include: {
          product: {
            select: { warranty: true },
          },
        },
      },
      payments: true,
      shop: {
        select: {
          name: true,
          code: true,
          contactPhone: true,
          contactEmail: true,
          address: true,
          gstin: true,
          logoUrl: true,
          invoiceFooter: true,
        },
      },
    },
  });
  if (!sale) throw new NotFoundError('Sale not found');
  return sale;
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
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, shopId },
    include: {
      items: {
        include: {
          product: {
            select: { warranty: true },
          },
        },
      },
      payments: true,
      shop: {
        select: {
          name: true,
          code: true,
          contactPhone: true,
          contactEmail: true,
          address: true,
          gstin: true,
          logoUrl: true,
          invoiceFooter: true,
        },
      },
    },
  });
  if (!sale) throw new NotFoundError('Invoice not found');
  return sale;
}

export async function cancelSale(shopId, saleId, userId) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, shopId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundError('Sale not found');
    if (sale.status === 'CANCELLED') throw new ConflictError('Sale already cancelled');

    // Reverse stock movements
    for (const item of sale.items) {
      await tx.inventory.update({
        where: { shopId_productId: { shopId, productId: item.productId } },
        data: { quantity: { increment: item.quantity } },
      });

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
      where: { id: saleId, shopId, status: 'COMPLETED' },
      include: { items: true },
    });
    if (!sale) throw new NotFoundError('Completed sale not found');

    let refundAmount = 0;

    for (const returnItem of data.items) {
      const saleItem = sale.items.find((si) => si.id === returnItem.saleItemId);
      if (!saleItem) throw new NotFoundError(`Sale item ${returnItem.saleItemId} not found`);
      if (returnItem.quantity > saleItem.quantity) {
        throw new BadRequestError(`Return quantity exceeds sold quantity`);
      }

      // Restore stock
      await tx.inventory.update({
        where: { shopId_productId: { shopId, productId: saleItem.productId } },
        data: { quantity: { increment: returnItem.quantity } },
      });

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

      // Calculate refund for this line item proportionally
      const pricePerUnit = round2(Number(saleItem.lineTotal) / saleItem.quantity);
      refundAmount += round2(pricePerUnit * returnItem.quantity);
    }

    refundAmount = round2(refundAmount);

    // Update sale status
    await tx.sale.update({
      where: { id: saleId },
      data: { status: 'REFUNDED' },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        shopId,
        userId,
        action: 'SALE_RETURN',
        entityType: 'Sale',
        entityId: saleId,
        details: { returnedItems: data.items, refundAmount },
      },
    });

    return { saleId, refundAmount, status: 'REFUNDED' };
  });
}
