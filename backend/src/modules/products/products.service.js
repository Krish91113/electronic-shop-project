import prisma from '../../config/db.js';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errors.js';
import { slugify, parsePagination, paginationMeta } from '../../utils/helpers.js';
import { applyPricingRule } from '../../utils/pricing.js';
import { round2 } from '../../utils/money.js';

export async function createProduct(shopId, data, userId) {
  // Check barcode uniqueness within shop (only if barcode provided)
  if (data.barcode) {
    const existing = await prisma.product.findFirst({
      where: { shopId, barcode: data.barcode },
    });
    if (existing) throw new ConflictError('Barcode already exists in this shop');
  }

  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });

  // Compute default selling price if not provided
  let defaultSellingPrice = data.defaultSellingPrice;
  if (defaultSellingPrice === undefined || defaultSellingPrice === null) {
    defaultSellingPrice = applyPricingRule(data.purchaseCost, shop.pricingRule);
  }

  const slug = slugify(data.name) + '-' + Date.now().toString(36);

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        shopId,
        barcode: data.barcode || null,
        name: data.name,
        slug,
        brand: data.brand || null,
        model: data.model || null,
        category: data.category || null,
        description: data.description || null,
        purchaseCost: data.purchaseCost,
        defaultSellingPrice,
        pricingRule: data.pricingRule || null,
        lowStockThreshold: data.lowStockThreshold ?? 5,
        warranty: data.warranty || null,
        taxCategoryId: data.taxCategoryId || null,
        isPublished: data.isPublished ?? true,
      },
      include: { taxCategory: true, images: true },
    });

    // Create inventory record
    const initialQty = data.initialStock || 0;
    await tx.inventory.create({
      data: { shopId, productId: p.id, quantity: initialQty },
    });

    // Create opening stock movement if initialStock > 0
    if (initialQty > 0) {
      await tx.stockMovement.create({
        data: {
          shopId,
          productId: p.id,
          movementType: 'OPENING',
          quantityDelta: initialQty,
          unitCost: data.purchaseCost,
          notes: 'Initial stock on product creation',
          createdBy: userId,
        },
      });
    }

    return p;
  });

  return product;
}

export async function updateProduct(shopId, productId, data, userId) {
  const product = await prisma.product.findFirst({
    where: { id: productId, shopId },
  });
  if (!product) throw new NotFoundError('Product not found');

  // Check barcode uniqueness if barcode changed
  if (data.barcode !== undefined && data.barcode !== null && data.barcode !== product.barcode) {
    const existing = await prisma.product.findFirst({
      where: { shopId, barcode: data.barcode, id: { not: productId } },
    });
    if (existing) throw new ConflictError('Barcode already exists in this shop');
  }

  // Audit log for price override
  if (data.defaultSellingPrice !== undefined && data.defaultSellingPrice !== Number(product.defaultSellingPrice)) {
    await prisma.auditLog.create({
      data: {
        shopId,
        userId,
        action: 'PRICE_OVERRIDE',
        entityType: 'Product',
        entityId: productId,
        details: {
          oldPrice: Number(product.defaultSellingPrice),
          newPrice: data.defaultSellingPrice,
        },
      },
    });
  }

  const updateData = {};
  const allowedFields = [
    'barcode', 'name', 'brand', 'model', 'category', 'description',
    'purchaseCost', 'defaultSellingPrice', 'pricingRule',
    'lowStockThreshold', 'warranty', 'taxCategoryId',
    'isPublished', 'isActive',
  ];
  for (const field of allowedFields) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }

  return prisma.product.update({
    where: { id: productId },
    data: updateData,
    include: { taxCategory: true, images: true, inventory: true },
  });
}

export async function getProduct(shopId, productId) {
  const product = await prisma.product.findFirst({
    where: { id: productId, shopId },
    include: { taxCategory: true, images: true, inventory: true },
  });
  if (!product) throw new NotFoundError('Product not found');
  return product;
}

export async function listProducts(shopId, query) {
  const { page, limit, skip } = parsePagination(query);
  const where = { shopId };
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { barcode: { contains: query.search, mode: 'insensitive' } },
      { brand: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.brand) where.brand = { contains: query.brand, mode: 'insensitive' };
  if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { taxCategory: true, images: true, inventory: true },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  return { products, pagination: paginationMeta(total, page, limit) };
}

export async function scanBarcode(shopId, barcode) {
  const product = await prisma.product.findFirst({
    where: { shopId, barcode },
    include: { taxCategory: true, images: true, inventory: true },
  });
  if (!product) throw new NotFoundError('Product not found for this barcode');
  return product;
}
