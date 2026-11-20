import prisma from '../../config/db.js';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errors.js';
import { round2 } from '../../utils/money.js';
import { parsePagination, paginationMeta } from '../../utils/helpers.js';
import { cleanImei, validateImei, previewImeiBatch } from '../../utils/imei.js';

/**
 * Preview pasted / scanned IMEIs before committing receipt.
 */
export async function previewReceive(shopId, units) {
  // Extract all imeis to check in database
  const imeisToCheck = [];
  for (const u of units) {
    if (u.imei1) imeisToCheck.push(cleanImei(u.imei1));
    if (u.imei2) imeisToCheck.push(cleanImei(u.imei2));
  }

  const existingUnits = await prisma.stockUnit.findMany({
    where: {
      shopId,
      OR: [
        { imei1: { in: imeisToCheck } },
        { imei2: { in: imeisToCheck } },
      ],
    },
    include: {
      saleItem: {
        include: {
          sale: {
            select: { invoiceNumber: true },
          },
        },
      },
    },
  });

  const existingMap = new Map();
  for (const u of existingUnits) {
    const info = {
      status: u.status,
      invoiceNumber: u.saleItem?.sale?.invoiceNumber || null,
    };
    if (u.imei1) existingMap.set(u.imei1, info);
    if (u.imei2) existingMap.set(u.imei2, info);
  }

  return previewImeiBatch(units, existingMap);
}

/**
 * Receive batch of serialized StockUnits.
 * All units inserted, inventory bumped, stock movements recorded in a single transaction.
 */
export async function receiveUnits(shopId, data, userId) {
  const { productId, supplier, purchaseRef, purchaseCost, sellingPrice, units } = data;

  return prisma.$transaction(async (tx) => {
    // 1. Lock and verify product
    const [product] = await tx.$queryRaw`
      SELECT * FROM "Product"
      WHERE id = ${productId} AND "shopId" = ${shopId}
      FOR UPDATE
    `;
    if (!product) throw new NotFoundError('Product not found in this shop');

    // 2. Preview & validate all units
    const imeisToCheck = [];
    for (const u of units) {
      if (u.imei1) imeisToCheck.push(cleanImei(u.imei1));
      if (u.imei2) imeisToCheck.push(cleanImei(u.imei2));
    }

    const existingUnits = await tx.stockUnit.findMany({
      where: {
        shopId,
        OR: [
          { imei1: { in: imeisToCheck } },
          { imei2: { in: imeisToCheck } },
        ],
      },
      include: {
        saleItem: {
          include: {
            sale: {
              select: { invoiceNumber: true },
            },
          },
        },
      },
    });

    const existingMap = new Map();
    for (const u of existingUnits) {
      const info = {
        status: u.status,
        invoiceNumber: u.saleItem?.sale?.invoiceNumber || null,
      };
      if (u.imei1) existingMap.set(u.imei1, info);
      if (u.imei2) existingMap.set(u.imei2, info);
    }

    const preview = previewImeiBatch(units, existingMap);

    if (preview.invalid.length > 0) {
      const first = preview.invalid[0];
      throw new BadRequestError(`Invalid IMEI at row ${first.index + 1} (${first.imei1}): ${first.reason}`);
    }

    if (preview.duplicatesInBatch.length > 0) {
      const first = preview.duplicatesInBatch[0];
      throw new ConflictError(`Duplicate IMEI in batch at row ${first.index + 1}: ${first.imei1}`);
    }

    if (preview.alreadyInShop.length > 0) {
      const conflicts = preview.alreadyInShop.map(
        (c) => `${c.imei1} (already ${c.status}${c.invoiceNumber ? ` on invoice ${c.invoiceNumber}` : ''})`
      );
      throw new ConflictError(`One or more IMEIs already exist in this shop: ${conflicts.join(', ')}`);
    }

    // 3. Insert StockUnits
    const createdUnits = [];
    const unitCount = preview.valid.length;

    for (const u of preview.valid) {
      const unitCost = round2(u.purchaseCost ?? purchaseCost);
      const unitPrice = u.sellingPrice !== undefined && u.sellingPrice !== null ? round2(u.sellingPrice) : (sellingPrice ? round2(sellingPrice) : null);

      const unit = await tx.stockUnit.create({
        data: {
          shopId,
          productId,
          imei1: u.imei1,
          imei2: u.imei2 || null,
          serialNumber: u.serialNumber || null,
          chargerNo: u.chargerNo || null,
          purchaseCost: unitCost,
          sellingPrice: unitPrice,
          status: 'IN_STOCK',
          supplier: supplier || null,
          purchaseRef: purchaseRef || null,
        },
      });
      createdUnits.push(unit);

      // StockMovement per unit
      await tx.stockMovement.create({
        data: {
          shopId,
          productId,
          stockUnitId: unit.id,
          movementType: 'RECEIPT',
          quantityDelta: 1,
          unitCost,
          referenceType: 'RECEIPT',
          referenceId: purchaseRef || null,
          notes: `Received IMEI ${u.imei1}`,
          createdBy: userId,
        },
      });
    }

    // 4. Update Product: set trackSerial to true, update last purchaseCost
    await tx.product.update({
      where: { id: productId },
      data: {
        trackSerial: true,
        purchaseCost: round2(purchaseCost),
        defaultSellingPrice: sellingPrice ? round2(sellingPrice) : product.defaultSellingPrice,
      },
    });

    // 5. Bump Inventory.quantity atomically
    const inv = await tx.inventory.upsert({
      where: { shopId_productId: { shopId, productId } },
      create: { shopId, productId, quantity: unitCount },
      update: { quantity: { increment: unitCount } },
    });

    // 6. AuditLog
    await tx.auditLog.create({
      data: {
        shopId,
        userId,
        action: 'RECEIVE_STOCK_UNITS',
        entityType: 'Product',
        entityId: productId,
        details: {
          receivedCount: unitCount,
          purchaseRef: purchaseRef || null,
          supplier: supplier || null,
          purchaseCost,
          imeis: createdUnits.map((u) => u.imei1),
        },
      },
    });

    return {
      receivedCount: unitCount,
      inventory: inv,
      units: createdUnits,
    };
  });
}

/**
 * List StockUnits for a shop/model, filter by status or search IMEI.
 */
export async function listStockUnits(shopId, query) {
  const { page, limit, skip } = parsePagination(query);
  const where = { shopId };

  if (query.productId) where.productId = query.productId;
  if (query.status) where.status = query.status;

  if (query.q) {
    const q = cleanImei(query.q) || query.q.trim();
    where.OR = [
      { imei1: { contains: q, mode: 'insensitive' } },
      { imei2: { contains: q, mode: 'insensitive' } },
      { serialNumber: { contains: q, mode: 'insensitive' } },
      { chargerNo: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [units, total] = await Promise.all([
    prisma.stockUnit.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            model: true,
            variant: true,
            color: true,
            category: true,
            hsnCode: true,
            defaultSellingPrice: true,
          },
        },
        saleItem: {
          include: {
            sale: {
              select: {
                id: true,
                invoiceNumber: true,
                createdAt: true,
                customerName: true,
              },
            },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stockUnit.count({ where }),
  ]);

  return { units, pagination: paginationMeta(total, page, limit) };
}

/**
 * Lookup an IMEI (imei1 or imei2) for billing or scanning.
 */
export async function lookupImei(shopId, imei) {
  const cleaned = cleanImei(imei);
  if (!cleaned) throw new BadRequestError('Invalid IMEI query');

  const unit = await prisma.stockUnit.findFirst({
    where: {
      shopId,
      OR: [{ imei1: cleaned }, { imei2: cleaned }],
    },
    include: {
      product: {
        include: {
          taxCategory: true,
        },
      },
      saleItem: {
        include: {
          sale: {
            select: {
              id: true,
              invoiceNumber: true,
              createdAt: true,
              customerName: true,
            },
          },
        },
      },
    },
  });

  if (!unit) {
    throw new NotFoundError(`IMEI ${cleaned} not found in this shop`);
  }

  return unit;
}

/**
 * Update stock unit fields (chargerNo, notes, sellingPrice, supplier, status).
 */
export async function updateStockUnit(shopId, unitId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const unit = await tx.stockUnit.findFirst({
      where: { id: unitId, shopId },
      include: { product: true },
    });
    if (!unit) throw new NotFoundError('Stock unit not found');

    if (unit.status === 'SOLD') {
      throw new ConflictError('Cannot modify status or details of an already SOLD stock unit');
    }

    const newStatus = data.status;
    const oldStatus = unit.status;

    // Handle stock changes if status changed
    if (newStatus && newStatus !== oldStatus) {
      if (oldStatus === 'IN_STOCK' && (newStatus === 'DAMAGED' || newStatus === 'RETURNED_TO_SUPPLIER')) {
        // Deduct from in-stock inventory
        await tx.inventory.update({
          where: { shopId_productId: { shopId, productId: unit.productId } },
          data: { quantity: { decrement: 1 } },
        });

        await tx.stockMovement.create({
          data: {
            shopId,
            productId: unit.productId,
            stockUnitId: unit.id,
            movementType: newStatus,
            quantityDelta: -1,
            unitCost: unit.purchaseCost,
            referenceType: 'ADJUSTMENT',
            notes: `Unit marked as ${newStatus}`,
            createdBy: userId,
          },
        });
      } else if ((oldStatus === 'DAMAGED' || oldStatus === 'RETURNED_TO_SUPPLIER') && newStatus === 'IN_STOCK') {
        // Return back to in-stock inventory
        await tx.inventory.update({
          where: { shopId_productId: { shopId, productId: unit.productId } },
          data: { quantity: { increment: 1 } },
        });

        await tx.stockMovement.create({
          data: {
            shopId,
            productId: unit.productId,
            stockUnitId: unit.id,
            movementType: 'ADJUSTMENT',
            quantityDelta: 1,
            unitCost: unit.purchaseCost,
            referenceType: 'ADJUSTMENT',
            notes: `Unit restored to IN_STOCK from ${oldStatus}`,
            createdBy: userId,
          },
        });
      }
    }

    const updated = await tx.stockUnit.update({
      where: { id: unitId },
      data: {
        chargerNo: data.chargerNo !== undefined ? data.chargerNo : unit.chargerNo,
        notes: data.notes !== undefined ? data.notes : unit.notes,
        sellingPrice: data.sellingPrice !== undefined ? (data.sellingPrice ? round2(data.sellingPrice) : null) : unit.sellingPrice,
        supplier: data.supplier !== undefined ? data.supplier : unit.supplier,
        purchaseRef: data.purchaseRef !== undefined ? data.purchaseRef : unit.purchaseRef,
        status: newStatus || unit.status,
      },
    });

    await tx.auditLog.create({
      data: {
        shopId,
        userId,
        action: 'UPDATE_STOCK_UNIT',
        entityType: 'StockUnit',
        entityId: unitId,
        details: { oldStatus, newStatus, updates: data },
      },
    });

    return updated;
  });
}

/**
 * Delete a stock unit (only if IN_STOCK and never sold).
 */
export async function deleteStockUnit(shopId, unitId, userId) {
  return prisma.$transaction(async (tx) => {
    const unit = await tx.stockUnit.findFirst({
      where: { id: unitId, shopId },
    });
    if (!unit) throw new NotFoundError('Stock unit not found');

    if (unit.status !== 'IN_STOCK' || unit.saleItemId) {
      throw new ConflictError('Only unsold IN_STOCK units can be deleted');
    }

    // Decrement inventory
    await tx.inventory.update({
      where: { shopId_productId: { shopId, productId: unit.productId } },
      data: { quantity: { decrement: 1 } },
    });

    // Record adjustment movement
    await tx.stockMovement.create({
      data: {
        shopId,
        productId: unit.productId,
        movementType: 'ADJUSTMENT',
        quantityDelta: -1,
        unitCost: unit.purchaseCost,
        referenceType: 'DELETION',
        notes: `Stock unit IMEI ${unit.imei1} deleted`,
        createdBy: userId,
      },
    });

    await tx.stockUnit.delete({
      where: { id: unitId },
    });

    await tx.auditLog.create({
      data: {
        shopId,
        userId,
        action: 'DELETE_STOCK_UNIT',
        entityType: 'StockUnit',
        entityId: unitId,
        details: { imei1: unit.imei1 },
      },
    });

    return { id: unitId, deleted: true };
  });
}
