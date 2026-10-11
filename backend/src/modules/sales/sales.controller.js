import * as service from './sales.service.js';

export async function create(req, res, next) {
  try {
    const sale = await service.createSale(req.shopId, req.body, req.user.id);
    res.status(201).json({ data: sale });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const sale = await service.getSale(req.shopId, req.params.id);
    res.json({ data: sale });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await service.listSales(req.shopId, req.query);
    res.json({ data: result.sales, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function invoice(req, res, next) {
  try {
    const data = await service.getInvoice(req.shopId, req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function cancel(req, res, next) {
  try {
    const sale = await service.cancelSale(req.shopId, req.params.id, req.user.id);
    res.json({ data: sale });
  } catch (err) {
    next(err);
  }
}

export async function returnItems(req, res, next) {
  try {
    const result = await service.returnSaleItems(req.shopId, req.params.id, req.body, req.user.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
