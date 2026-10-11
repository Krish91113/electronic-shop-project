import * as service from './taxCategories.service.js';

/**
 * GET /api/v1/tax-categories
 */
export async function list(req, res, next) {
  try {
    const categories = await service.listTaxCategories(req.shopId);
    res.json({ data: categories });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/tax-categories
 */
export async function create(req, res, next) {
  try {
    const category = await service.createTaxCategory(req.shopId, req.body);
    res.status(201).json({ data: category });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/tax-categories/:tcId
 */
export async function update(req, res, next) {
  try {
    const category = await service.updateTaxCategory(req.shopId, req.params.tcId, req.body);
    res.json({ data: category });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/tax-categories/:tcId
 */
export async function remove(req, res, next) {
  try {
    await service.deleteTaxCategory(req.shopId, req.params.tcId);
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}
