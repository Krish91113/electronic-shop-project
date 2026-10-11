import * as service from './inventory.service.js';

export async function receive(req, res, next) {
  try {
    const result = await service.receiveStock(req.shopId, req.body, req.user.id);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function adjust(req, res, next) {
  try {
    const result = await service.adjustStock(req.shopId, req.body, req.user.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await service.listInventory(req.shopId, req.query);
    res.json({ data: result.items, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function lowStock(req, res, next) {
  try {
    const result = await service.listLowStock(req.shopId, req.query);
    res.json({ data: result.items, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function movements(req, res, next) {
  try {
    const result = await service.listMovements(req.shopId, req.query);
    res.json({ data: result.movements, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}
