import * as service from './dashboard.service.js';

export async function getDashboard(req, res, next) {
  try {
    const data = await service.getDashboard(req.shopId, req.query.from, req.query.to);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
