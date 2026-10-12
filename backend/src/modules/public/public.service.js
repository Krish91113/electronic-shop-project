import prisma from '../../config/db.js';
import { NotFoundError } from '../../utils/errors.js';
import { parsePagination, paginationMeta } from '../../utils/helpers.js';

/** Public fields only — never expose cost, margins, supplier data */
const PUBLIC_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  brand: true,
  model: true,
  category: true,
  description: true,
  defaultSellingPrice: true,
  warranty: true,
  isPublished: true,
  images: {
    select: { id: true, url: true, isPrimary: true },
  },
};

export async function listPublicShops() {
  const shops = await prisma.shop.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      contactPhone: true,
      logoUrl: true,
    },
    orderBy: { name: 'asc' },
  });

  const result = await Promise.all(
    shops.map(async (shop) => {
      const [productCount, inStockCount] = await Promise.all([
        prisma.product.count({
          where: {
            shopId: shop.id,
            isPublished: true,
            isActive: true,
          },
        }),
        prisma.product.count({
          where: {
            shopId: shop.id,
            isPublished: true,
            isActive: true,
            inventory: { quantity: { gt: 0 } },
          },
        }),
      ]);

      return {
        name: shop.name,
        slug: shop.slug,
        address: shop.address,
        contactPhone: shop.contactPhone,
        logoUrl: shop.logoUrl,
        productCount,
        inStockCount,
      };
    })
  );

  return result;
}

export async function getPublicShop(shopSlug) {
  const shop = await prisma.shop.findUnique({
    where: { slug: shopSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      contactPhone: true,
      logoUrl: true,
    },
  });
  if (!shop) throw new NotFoundError('Shop not found');

  const [productCount, inStockCount] = await Promise.all([
    prisma.product.count({
      where: {
        shopId: shop.id,
        isPublished: true,
        isActive: true,
      },
    }),
    prisma.product.count({
      where: {
        shopId: shop.id,
        isPublished: true,
        isActive: true,
        inventory: { quantity: { gt: 0 } },
      },
    }),
  ]);

  return {
    name: shop.name,
    slug: shop.slug,
    address: shop.address,
    contactPhone: shop.contactPhone,
    logoUrl: shop.logoUrl,
    productCount,
    inStockCount,
  };
}

export async function listPublicProducts(shopSlug, query) {
  const shop = await prisma.shop.findUnique({ where: { slug: shopSlug } });
  if (!shop) throw new NotFoundError('Shop not found');

  const { page, limit, skip } = parsePagination(query);
  const where = { shopId: shop.id, isPublished: true, isActive: true };

  if (query.inStock === 'true' || query.inStock === true) {
    where.inventory = { quantity: { gt: 0 } };
  }

  if (query.category) {
    where.category = { equals: query.category, mode: 'insensitive' };
  }

  if (query.search) {
    const s = String(query.search).trim();
    if (s) {
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { brand: { contains: s, mode: 'insensitive' } },
        { model: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { category: { contains: s, mode: 'insensitive' } },
      ];
    }
  }
  if (query.brand) where.brand = { contains: query.brand, mode: 'insensitive' };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        ...PUBLIC_PRODUCT_SELECT,
        inventory: { select: { quantity: true } },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  // Map to public response: show availability but not exact count
  const mapped = products.map((p) => {
    const inStock = p.inventory ? p.inventory.quantity > 0 : false;
    const { inventory, ...rest } = p;
    return {
      ...rest,
      inStock,
    };
  });

  return { products: mapped, pagination: paginationMeta(total, page, limit) };
}

export async function getPublicProduct(shopSlug, slugOrId) {
  const shop = await prisma.shop.findUnique({ where: { slug: shopSlug } });
  if (!shop) throw new NotFoundError('Shop not found');

  const product = await prisma.product.findFirst({
    where: {
      shopId: shop.id,
      isPublished: true,
      isActive: true,
      OR: [{ slug: slugOrId }, { id: slugOrId }],
    },
    select: {
      ...PUBLIC_PRODUCT_SELECT,
      inventory: { select: { quantity: true } },
    },
  });
  if (!product) throw new NotFoundError('Product not found');

  const inStock = product.inventory ? product.inventory.quantity > 0 : false;
  const { inventory, ...rest } = product;
  return {
    ...rest,
    inStock,
  };
}
