import * as service from './images.service.js';

export async function upload(req, res, next) {
  try {
    const image = await service.uploadProductImage(req.shopId, req.params.productId, req.file);
    res.status(201).json({ data: image });
  } catch (err) {
    next(err);
  }
}

export async function setPrimary(req, res, next) {
  try {
    const image = await service.setPrimaryImage(req.shopId, req.params.imageId);
    res.json({ data: image });
  } catch (err) {
    next(err);
  }
}

export async function signedUpload(req, res, next) {
  try {
    const params = await service.getSignedUploadParams(req.shopId, req.body.productId);
    res.json({ data: params });
  } catch (err) {
    next(err);
  }
}

export async function attach(req, res, next) {
  try {
    const image = await service.attachImage(req.shopId, req.body);
    res.status(201).json({ data: image });
  } catch (err) {
    next(err);
  }
}

export async function replace(req, res, next) {
  try {
    const image = await service.replaceImage(req.shopId, req.params.imageId, req.body);
    res.json({ data: image });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await service.removeImage(req.shopId, req.params.imageId);
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}
