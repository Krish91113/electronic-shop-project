import * as service from './reports.service.js';
import { BadRequestError } from '../../utils/errors.js';

export async function profitLoss(req, res, next) {
  try {
    const { from, to } = req.query;
    if (!from || !to) throw new BadRequestError('from and to query params required');
    const report = await service.profitLoss(req.shopId, from, to, req.shop.timezone);
    res.json({ data: report });
  } catch (err) {
    next(err);
  }
}

export async function stockValuation(req, res, next) {
  try {
    const report = await service.stockValuation(req.shopId);
    res.json({ data: report });
  } catch (err) {
    next(err);
  }
}

export async function salesByModel(req, res, next) {
  try {
    const { from, to } = req.query;
    const report = await service.salesByModel(req.shopId, from, to);
    res.json({ data: report });
  } catch (err) {
    next(err);
  }
}

export async function imeiHistory(req, res, next) {
  try {
    const report = await service.imeiHistory(req.shopId, req.params.imei);
    res.json({ data: report });
  } catch (err) {
    next(err);
  }
}
