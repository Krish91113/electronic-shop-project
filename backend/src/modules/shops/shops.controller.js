import * as service from './shops.service.js';

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
    const shops = await service.listUserShops(req.user.id);
    res.json({ data: shops });
  } catch (err) {
    next(err);
  }
}
