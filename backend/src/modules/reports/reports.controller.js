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
