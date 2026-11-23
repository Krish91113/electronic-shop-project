import * as service from './stockUnits.service.js';

export async function receive(req, res, next) {
  try {
    const result = await service.receiveUnits(req.shopId, req.body, req.user.id);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function preview(req, res, next) {
  try {
    const result = await service.previewReceive(req.shopId, req.body.units);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await service.listStockUnits(req.shopId, req.query);
    res.json({ data: result.units, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function lookup(req, res, next) {
  try {
    const result = await service.lookupImei(req.shopId, req.params.imei);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const result = await service.updateStockUnit(req.shopId, req.params.id, req.body, req.user.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await service.deleteStockUnit(req.shopId, req.params.id, req.user.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

