import prisma from '../../config/db.js';
import cloudinary from '../../config/cloudinary.js';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errors.js';
import { slugify, parsePagination, paginationMeta } from '../../utils/helpers.js';
import { applyPricingRule } from '../../utils/pricing.js';
import { round2 } from '../../utils/money.js';
import { computeModelKey, parseProductModel } from '../../utils/modelKey.js';
import { cleanImei } from '../../utils/imei.js';

export async function searchModels(shopId, query) {
  const { q, brand, category } = query;
  const where = { shopId, isActive: true };

  const conditions = [];
  if (q && q.trim()) {
    const term = q.trim();
    conditions.push({ name: { contains: term, mode: 'insensitive' } });
    conditions.push({ brand: { contains: term, mode: 'insensitive' } });
    conditions.push({ model: { contains: term, mode: 'insensitive' } });
    conditions.push({ variant: { contains: term, mode: 'insensitive' } });
    conditions.push({ color: { contains: term, mode: 'insensitive' } });
  }

  if (conditions.length > 0) {
    where.OR = conditions;
  }
  if (brand) where.brand = { contains: brand.trim(), mode: 'insensitive' };
  if (category) where.category = { contains: category.trim(), mode: 'insensitive' };

  const products = await prisma.product.findMany({
    where,
    take: 15,
    include: {
      stockUnits: {
        where: { status: 'IN_STOCK' },
        select: { id: true },
      },
      inventory: true,
    },
    orderBy: [{ brand: 'asc' }, { model: 'asc' }],
  });

  return products.map((p) => {
    const inStockCount = p.trackSerial ? p.stockUnits.length : (p.inventory?.quantity || 0);
    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      model: p.model,
      variant: p.variant,
      color: p.color,
      category: p.category,
      hsnCode: p.hsnCode,
      trackSerial: p.trackSerial,
      defaultSellingPrice: p.defaultSellingPrice ? Number(p.defaultSellingPrice) : null,
      inStockCount,
      modelKey: p.modelKey,
    };
  });
}

export async function getBrands(shopId, q) {
  const where = { shopId, brand: { not: null }, isActive: true };
  if (q && q.trim()) {
    where.brand = { contains: q.trim(), mode: 'insensitive' };
  }
  const products = await prisma.product.findMany({
    where,
    select: { brand: true },
    distinct: ['brand'],
    take: 30,
  });
  return products.map((p) => p.brand).filter(Boolean);
}

export async function getCategories(shopId, q) {
  const where = { shopId, category: { not: null }, isActive: true };
  if (q && q.trim()) {
    where.category = { contains: q.trim(), mode: 'insensitive' };
  }
  const products = await prisma.product.findMany({
    where,
    select: { category: true },
    distinct: ['category'],
    take: 30,
  });
  return products.map((p) => p.category).filter(Boolean);
}

export async function createProduct(shopId, data, userId) {
  // Check barcode uniqueness within shop (only if barcode provided)
  if (data.barcode) {
    const existing = await prisma.product.findFirst({
      where: { shopId, barcode: data.barcode },
    });
    if (existing) throw new ConflictError('Barcode already exists in this shop');
  }

  // Parse and compute modelKey
  const parsed = parseProductModel(data.name);
  const brand = data.brand || parsed.brand || null;
  const model = data.model || parsed.model || null;
  const variant = data.variant || parsed.variant || null;
  const color = data.color || parsed.color || null;

  const modelKey = computeModelKey({ brand, model, variant, color, name: data.name });

  // Duplicate modelKey check within shop
  if (modelKey) {
    const existingModel = await prisma.product.findFirst({
      where: { shopId, modelKey, isActive: true },
    });
    if (existingModel) {
      const err = new ConflictError(
        `A product model variant with this brand, model, variant, and color already exists: "${existingModel.name}"`
      );
      err.code = 'DUPLICATE_MODEL';
      err.existingProductId = existingModel.id;
      err.existingProduct = existingModel;
      throw err;
    }
  }

  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });

  // Compute default selling price if not provided
  let defaultSellingPrice = data.defaultSellingPrice;
  if (defaultSellingPrice === undefined || defaultSellingPrice === null) {
    defaultSellingPrice = applyPricingRule(data.purchaseCost, shop.pricingRule);
  }

  const isPhone = Boolean(
    data.trackSerial ||
    (data.category && /phone|mobile/i.test(data.category)) ||
    (brand && /oppo|vivo|samsung|realme|oneplus|apple|xiaomi|mi|redmi|tecno|nokia/i.test(brand))
  );
  const trackSerial = data.trackSerial !== undefined ? data.trackSerial : isPhone;
  const hsnCode = data.hsnCode || (trackSerial ? '8517' : null);

  const slug = slugify(data.name) + '-' + Date.now().toString(36);

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        shopId,
        barcode: data.barcode || null,
        name: data.name,
        slug,
        brand,
        model,
        variant,
        color,
        category: data.category || null,
        description: data.description || null,
        hsnCode,
        trackSerial,
        modelKey,
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

  // Recompute modelKey if any component changed
  const brand = data.brand !== undefined ? data.brand : product.brand;
  const model = data.model !== undefined ? data.model : product.model;
  const variant = data.variant !== undefined ? data.variant : product.variant;
  const color = data.color !== undefined ? data.color : product.color;
  const name = data.name !== undefined ? data.name : product.name;

  const modelKey = computeModelKey({ brand, model, variant, color, name });
  if (modelKey && modelKey !== product.modelKey) {
    const existingModel = await prisma.product.findFirst({
      where: { shopId, modelKey, id: { not: productId }, isActive: true },
    });
    if (existingModel) {
      const err = new ConflictError(
        `A product model variant with this brand, model, variant, and color already exists: "${existingModel.name}"`
      );
      err.code = 'DUPLICATE_MODEL';
      err.existingProductId = existingModel.id;
      throw err;
    }
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

  const updateData = { modelKey };
  const allowedFields = [
    'barcode', 'name', 'brand', 'model', 'variant', 'color', 'category', 'description',
    'hsnCode', 'trackSerial', 'purchaseCost', 'defaultSellingPrice', 'pricingRule',
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
    include: {
      taxCategory: true,
      images: true,
      inventory: true,
      stockUnits: {
        orderBy: { receivedAt: 'desc' },
      },
    },
  });
  if (!product) throw new NotFoundError('Product not found');

  const inStockUnits = product.stockUnits.filter((u) => u.status === 'IN_STOCK');
  const soldUnits = product.stockUnits.filter((u) => u.status === 'SOLD');
  const inStockCount = product.trackSerial ? inStockUnits.length : (product.inventory?.quantity || 0);

  return {
    ...product,
    inStockCount,
    soldCount: soldUnits.length,
    inStockUnits,
  };
}

export async function listProducts(shopId, query) {
  const { page, limit, skip } = parsePagination(query);
  const where = { shopId };

  if (query.search) {
    const term = query.search.trim();
    const cleanedImeiTerm = cleanImei(term);

    const orConditions = [
      { name: { contains: term, mode: 'insensitive' } },
      { barcode: { contains: term, mode: 'insensitive' } },
      { brand: { contains: term, mode: 'insensitive' } },
      { model: { contains: term, mode: 'insensitive' } },
      { variant: { contains: term, mode: 'insensitive' } },
      { color: { contains: term, mode: 'insensitive' } },
    ];

    if (cleanedImeiTerm && cleanedImeiTerm.length >= 4) {
      // Find products matching IMEI
      const matchingUnits = await prisma.stockUnit.findMany({
        where: {
          shopId,
          OR: [
            { imei1: { contains: cleanedImeiTerm } },
            { imei2: { contains: cleanedImeiTerm } },
          ],
        },
        select: { productId: true },
      });
      if (matchingUnits.length > 0) {
        orConditions.push({ id: { in: matchingUnits.map((u) => u.productId) } });
      }
    }

    where.OR = orConditions;
  }

  if (query.brand) where.brand = { contains: query.brand.trim(), mode: 'insensitive' };
  if (query.category) where.category = { contains: query.category.trim(), mode: 'insensitive' };
  if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        taxCategory: true,
        images: true,
        inventory: true,
        stockUnits: {
          select: { id: true, status: true, sellingPrice: true, purchaseCost: true, imei1: true, imei2: true, chargerNo: true },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  const enhancedProducts = products.map((p) => {
    const inStockUnits = p.stockUnits.filter((u) => u.status === 'IN_STOCK');
    const soldUnits = p.stockUnits.filter((u) => u.status === 'SOLD');
    const inStockCount = p.trackSerial ? inStockUnits.length : (p.inventory?.quantity || 0);

    const prices = inStockUnits
      .map((u) => (u.sellingPrice ? Number(u.sellingPrice) : null))
      .filter((pr) => pr !== null);
    if (p.defaultSellingPrice) prices.push(Number(p.defaultSellingPrice));

    const minSellingPrice = prices.length > 0 ? Math.min(...prices) : Number(p.defaultSellingPrice || 0);
    const maxSellingPrice = prices.length > 0 ? Math.max(...prices) : Number(p.defaultSellingPrice || 0);

    return {
      ...p,
      inStockCount,
      soldCount: soldUnits.length,
      minSellingPrice,
      maxSellingPrice,
      units: p.stockUnits,
    };
  });

  return { products: enhancedProducts, pagination: paginationMeta(total, page, limit) };
}

export async function scanBarcode(shopId, barcode) {
  const cleaned = cleanImei(barcode);

  // Check StockUnit first if barcode is numeric / IMEI-like
  if (cleaned && cleaned.length >= 10) {
    const stockUnit = await prisma.stockUnit.findFirst({
      where: {
        shopId,
        OR: [{ imei1: cleaned }, { imei2: cleaned }],
      },
      include: {
        product: {
          include: { taxCategory: true, images: true, inventory: true },
        },
      },
    });

    if (stockUnit) {
      return {
        ...stockUnit.product,
        stockUnit,
        isSerialized: true,
      };
    }
  }

  // Fall back to product barcode (e.g. for accessories)
  const product = await prisma.product.findFirst({
    where: { shopId, barcode },
    include: { taxCategory: true, images: true, inventory: true },
  });
  if (!product) throw new NotFoundError('Product not found for this barcode/IMEI');
  return { ...product, isSerialized: false };
}

export async function deleteProduct(shopId, productId, userId) {
  const product = await prisma.product.findFirst({
    where: { id: productId, shopId },
    include: {
      images: true,
      saleItems: { take: 1 },
      stockUnits: { take: 1 },
    },
  });
  if (!product) throw new NotFoundError('Product not found');

  const hasSales = product.saleItems && product.saleItems.length > 0;
  const hasUnits = product.stockUnits && product.stockUnits.length > 0;

  // If product is associated with sales or stock units, soft-delete to maintain history
  if (hasSales || hasUnits) {
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false, isPublished: false },
    });
    return {
      id: productId,
      deleted: true,
      archived: true,
      message: 'Product archived from catalogue to preserve historical units and sales records.',
    };
  }

  // Otherwise, clean up associated Cloudinary images safely
  if (product.images && product.images.length > 0) {
    for (const img of product.images) {
      try {
        await cloudinary.uploader.destroy(img.publicId);
      } catch {
        // Silently continue
      }
    }
  }

  // Delete product
  await prisma.product.delete({
    where: { id: productId },
  });

  return { id: productId, deleted: true, archived: false };
}

