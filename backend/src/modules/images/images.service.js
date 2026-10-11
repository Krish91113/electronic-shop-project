import cloudinary from '../../config/cloudinary.js';
import prisma from '../../config/db.js';
import { NotFoundError } from '../../utils/errors.js';

export async function getSignedUploadParams(shopId, productId) {
  // Verify product belongs to shop
  const product = await prisma.product.findFirst({
    where: { id: productId, shopId },
  });
  if (!product) throw new NotFoundError('Product not found');

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `shops/${shopId}/products`;
  const params = {
    timestamp,
    folder,
    allowed_formats: 'jpg,jpeg,png,webp',
    max_file_size: 5000000, // 5MB
  };

  const signature = cloudinary.utils.api_sign_request(params, cloudinary.config().api_secret);

  return {
    ...params,
    signature,
    apiKey: cloudinary.config().api_key,
    cloudName: cloudinary.config().cloud_name,
  };
}

export async function attachImage(shopId, data) {
  const product = await prisma.product.findFirst({
    where: { id: data.productId, shopId },
  });
  if (!product) throw new NotFoundError('Product not found');

  // If isPrimary, set all other images to non-primary
  if (data.isPrimary) {
    await prisma.productImage.updateMany({
      where: { productId: data.productId },
      data: { isPrimary: false },
    });
  }

  return prisma.productImage.create({
    data: {
      productId: data.productId,
      publicId: data.publicId,
      url: data.url,
      isPrimary: data.isPrimary || false,
    },
  });
}

export async function replaceImage(shopId, imageId, data) {
  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    include: { product: true },
  });
  if (!image || image.product.shopId !== shopId) {
    throw new NotFoundError('Image not found');
  }

  // Delete old from cloudinary
  try {
    await cloudinary.uploader.destroy(image.publicId);
  } catch (e) {
    // Ignore cloudinary errors on cleanup
  }

  return prisma.productImage.update({
    where: { id: imageId },
    data: {
      publicId: data.publicId,
      url: data.url,
    },
  });
}

export async function removeImage(shopId, imageId) {
  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    include: { product: true },
  });
  if (!image || image.product.shopId !== shopId) {
    throw new NotFoundError('Image not found');
  }

  // Delete from cloudinary
  try {
    await cloudinary.uploader.destroy(image.publicId);
  } catch (e) {
    // Ignore cloudinary errors on cleanup
  }

  await prisma.productImage.delete({ where: { id: imageId } });
  return { deleted: true };
}
