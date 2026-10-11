import * as service from './public.service.js';

export async function listProducts(req, res, next) {
  try {
    const result = await service.listPublicProducts(req.params.shopSlug, req.query);
    res.json({ data: result.products, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req, res, next) {
  try {
    const product = await service.getPublicProduct(req.params.shopSlug, req.params.slugOrId);
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
}
