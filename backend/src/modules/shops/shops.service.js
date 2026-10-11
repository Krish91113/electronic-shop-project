import prisma from '../../config/db.js';
import { NotFoundError } from '../../utils/errors.js';

/**
 * Verify the user is a member of the shop, then return it.
 * Throws 404 (not 403) to avoid leaking shop-id existence.
 */
export async function getShopForUser(userId, shopId) {
  const membership = await prisma.shopMembership.findUnique({
    where: { userId_shopId: { userId, shopId } },
    include: { shop: true },
  });
  if (!membership) throw new NotFoundError('Shop not found');
  return membership.shop;
}

/**
 * Get a single shop by its id (internal/admin use).
 */
export async function getShop(shopId) {
  return prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
}

/**
 * Update mutable shop details (internal use — caller must authorize).
 */
export async function updateShop(shopId, data) {
  return prisma.shop.update({ where: { id: shopId }, data });
}

/**
 * Update a shop only after verifying the user is a member.
 */
export async function updateShopForUser(userId, shopId, data) {
  await getShopForUser(userId, shopId);
  return prisma.shop.update({ where: { id: shopId }, data });
}

/**
 * Return all shops the given user is a member of.
 */
export async function getUserShops(userId) {
  const memberships = await prisma.shopMembership.findMany({
    where: { userId },
    include: { shop: true },
  });
  return memberships.map((m) => ({ ...m.shop, memberRole: m.role }));
}

// Keep legacy alias used by existing controller handler name
export { getUserShops as listUserShops };
