import prisma from '../../config/db.js';

/**
 * List all tax categories for a shop.
 */
export async function listTaxCategories(shopId) {
  return prisma.taxCategory.findMany({
    where: { shopId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
}

/**
 * Create a new tax category for a shop.
 * If isDefault is true, clear the default flag on all other categories first.
 */
export async function createTaxCategory(shopId, data) {
  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.taxCategory.updateMany({
        where: { shopId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.taxCategory.create({
      data: {
        shopId,
        name: data.name,
        rate: data.rate,
        isDefault: data.isDefault ?? false,
      },
    });
  });
}

/**
 * Update an existing tax category.
 * Verifies the category belongs to the shop before updating.
 */
export async function updateTaxCategory(shopId, tcId, data) {
  return prisma.$transaction(async (tx) => {
    // Ownership check
    await tx.taxCategory.findFirstOrThrow({ where: { id: tcId, shopId } });

    if (data.isDefault) {
      await tx.taxCategory.updateMany({
        where: { shopId, isDefault: true, NOT: { id: tcId } },
        data: { isDefault: false },
      });
    }
    return tx.taxCategory.update({ where: { id: tcId }, data });
  });
}

/**
 * Delete a tax category.
 * Verifies the category belongs to the shop before deleting.
 */
export async function deleteTaxCategory(shopId, tcId) {
  await prisma.taxCategory.findFirstOrThrow({ where: { id: tcId, shopId } });
  return prisma.taxCategory.delete({ where: { id: tcId } });
}
