import * as service from './products.service.js';

export async function searchModels(req, res, next) {
  try {
    const results = await service.searchModels(req.shopId, req.query);
    res.json({ data: results });
  } catch (err) {
    next(err);
  }
}

export async function getBrands(req, res, next) {
  try {
    const brands = await service.getBrands(req.shopId, req.query.q);
    res.json({ data: brands });
  } catch (err) {
    next(err);
  }
}

export async function getCategories(req, res, next) {
  try {
    const categories = await service.getCategories(req.shopId, req.query.q);
    res.json({ data: categories });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const product = await service.createProduct(req.shopId, req.body, req.user.id);
    res.status(201).json({ data: product });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const product = await service.updateProduct(req.shopId, req.params.id, req.body, req.user.id);
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const product = await service.getProduct(req.shopId, req.params.id);
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await service.listProducts(req.shopId, req.query);
    res.json({ data: result.products, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function scan(req, res, next) {
  try {
    const product = await service.scanBarcode(req.shopId, req.body.barcode);
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await service.deleteProduct(req.shopId, req.params.id, req.user.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

