import prisma from '../../config/db.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { round2 } from '../../utils/money.js';
import { parsePagination, paginationMeta } from '../../utils/helpers.js';

/**
 * Receive stock — weighted average cost update + stock movement.
 */
export async function receiveStock(shopId, data, userId) {
  const { productId, quantity, unitCost, notes } = data;

  return prisma.$transaction(async (tx) => {
    // Verify product belongs to shop
    const product = await tx.product.findFirst({
      where: { id: productId, shopId },
    });
    if (!product) throw new NotFoundError('Product not found');

    // Get or create inventory row
    let inv = await tx.inventory.findUnique({
      where: { shopId_productId: { shopId, productId } },
    });
    if (!inv) {
      inv = await tx.inventory.create({
        data: { shopId, productId, quantity: 0 },
      });
    }

    // Weighted average cost calculation
    const oldQty = inv.quantity;
    const oldCost = Number(product.purchaseCost);
    const newTotalCost = oldCost * oldQty + unitCost * quantity;
    const newTotalQty = oldQty + quantity;
    const newAvgCost = newTotalQty > 0 ? round2(newTotalCost / newTotalQty) : unitCost;

    // Update product purchaseCost (weighted average)
    await tx.product.update({
      where: { id: productId },
      data: { purchaseCost: newAvgCost },
    });

    // Update inventory quantity
    await tx.inventory.update({
      where: { shopId_productId: { shopId, productId } },
      data: { quantity: newTotalQty },
    });

    // Record stock movement
    const movement = await tx.stockMovement.create({
      data: {
        shopId,
        productId,
        movementType: 'RECEIPT',
        quantityDelta: quantity,
        unitCost,
        referenceType: 'RECEIPT',
        notes: notes || null,
        createdBy: userId,
      },
    });

    return {
      movement,
      inventory: { productId, quantity: newTotalQty, weightedAvgCost: newAvgCost },
    };
  });
}

export async function adjustStock(shopId, data, userId) {
  const { productId, quantityDelta, movementType, notes } = data;

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: productId, shopId } });
    if (!product) throw new NotFoundError('Product not found');

    const inv = await tx.inventory.findUnique({
      where: { shopId_productId: { shopId, productId } },
    });
    if (!inv) throw new NotFoundError('Inventory record not found');

    const newQty = inv.quantity + quantityDelta;
    if (newQty < 0) throw new ConflictError('Adjustment would result in negative stock');

    await tx.inventory.update({
      where: { shopId_productId: { shopId, productId } },
      data: { quantity: newQty },
    });

    const movement = await tx.stockMovement.create({
      data: {
        shopId,
        productId,
        movementType,
        quantityDelta,
        unitCost: product.purchaseCost,
        referenceType: 'ADJUSTMENT',
        notes: notes || null,
        createdBy: userId,
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        shopId,
        userId,
        action: 'STOCK_ADJUSTMENT',
        entityType: 'Inventory',
        entityId: inv.id,
        details: { productId, quantityDelta, movementType, notes },
      },
    });

    return { movement, inventory: { productId, quantity: newQty } };
  });
}

export async function listInventory(shopId, query) {
  const { page, limit, skip } = parsePagination(query);
  const where = { shopId };

  const [items, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      include: {
        product: {
          select: {
            id: true, name: true, barcode: true, brand: true,
            purchaseCost: true, defaultSellingPrice: true,
            lowStockThreshold: true, images: { take: 1 },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.inventory.count({ where }),
  ]);

  return { items, pagination: paginationMeta(total, page, limit) };
}

export async function listLowStock(shopId, query) {
  const { page, limit, skip } = parsePagination(query);

  // Low stock: quantity <= product.lowStockThreshold
  const items = await prisma.$queryRaw`
    SELECT i.id, i."productId", i.quantity, i."shopId",
           p.name, p.barcode, p.brand, p."lowStockThreshold", p."purchaseCost", p."defaultSellingPrice"
    FROM "Inventory" i
    JOIN "Product" p ON i."productId" = p.id
    WHERE i."shopId" = ${shopId}
      AND i.quantity <= p."lowStockThreshold"
      AND p."isActive" = true
    ORDER BY i.quantity ASC
    LIMIT ${limit} OFFSET ${skip}
  `;

  const countResult = await prisma.$queryRaw`
    SELECT COUNT(*)::int as total
    FROM "Inventory" i
    JOIN "Product" p ON i."productId" = p.id
    WHERE i."shopId" = ${shopId}
      AND i.quantity <= p."lowStockThreshold"
      AND p."isActive" = true
  `;

  const total = countResult[0]?.total || 0;
  return { items, pagination: paginationMeta(total, page, limit) };
}

export async function listMovements(shopId, query) {
  const { page, limit, skip } = parsePagination(query);
  const where = { shopId };
  if (query.productId) where.productId = query.productId;
  if (query.movementType) where.movementType = query.movementType;

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: { product: { select: { id: true, name: true, barcode: true } } },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return { movements, pagination: paginationMeta(total, page, limit) };
}
