import * as service from './shops.service.js';

/**
 * GET /api/v1/shops
 * List all shops the authenticated user belongs to.
 */
export async function getMyShops(req, res, next) {
  try {
    const shops = await service.getUserShops(req.user.id);
    res.json({ data: shops });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/shops/:id
 * Get a single shop by id (must be a member).
 */
export async function getOne(req, res, next) {
  try {
    const shop = await service.getShopForUser(req.user.id, req.params.id);
    res.json({ data: shop });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/shops/:id
 * Update shop details. resolveShop sets req.shopId from the x-shop-id header;
 * here we use req.params.id explicitly so clients can target a shop by URL param.
 */
export async function update(req, res, next) {
  try {
    const shop = await service.updateShopForUser(req.user.id, req.params.id, req.body);
    res.json({ data: shop });
  } catch (err) {
    next(err);
  }
}

// ── Legacy handlers kept for existing /mine and /current routes ──────────────

export async function getShop(req, res, next) {
  try {
    const shop = await service.getShop(req.shopId);
    res.json({ data: shop });
  } catch (err) {
    next(err);
  }
}

export async function updateShop(req, res, next) {
  try {
    const shop = await service.updateShop(req.shopId, req.body);
    res.json({ data: shop });
  } catch (err) {
    next(err);
  }
}

export async function listUserShops(req, res, next) {
  try {
    const shops = await service.getUserShops(req.user.id);
    res.json({ data: shops });
  } catch (err) {
    next(err);
  }
}
