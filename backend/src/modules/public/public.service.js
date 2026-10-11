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

export async function listPublicProducts(shopSlug, query) {
  const shop = await prisma.shop.findUnique({ where: { slug: shopSlug } });
  if (!shop) throw new NotFoundError('Shop not found');

  const { page, limit, skip } = parsePagination(query);
  const where = { shopId: shop.id, isPublished: true, isActive: true };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { brand: { contains: query.search, mode: 'insensitive' } },
      { model: { contains: query.search, mode: 'insensitive' } },
    ];
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
  const mapped = products.map((p) => ({
    ...p,
    inStock: p.inventory ? p.inventory.quantity > 0 : false,
    inventory: undefined,
  }));

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

  return {
    ...product,
    inStock: product.inventory ? product.inventory.quantity > 0 : false,
    inventory: undefined,
  };
}
