import * as service from './payments.service.js';

export async function create(req, res, next) {
  try {
    const payment = await service.createPayment(req.shopId, req.body);
    res.status(201).json({ data: payment });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await service.listPayments(req.shopId, req.query);
    res.json({ data: result.payments, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const payment = await service.getPayment(req.shopId, req.params.id);
    res.json({ data: payment });
  } catch (err) {
    next(err);
  }
}
