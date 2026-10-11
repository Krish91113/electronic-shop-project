import prisma from '../../config/db.js';

export async function getShop(shopId) {
  return prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
}

export async function updateShop(shopId, data) {
  return prisma.shop.update({ where: { id: shopId }, data });
}

export async function listUserShops(userId) {
  const memberships = await prisma.shopMembership.findMany({
    where: { userId },
    include: { shop: true },
  });
  return memberships.map((m) => m.shop);
}
