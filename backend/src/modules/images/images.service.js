import cloudinary from '../../config/cloudinary.js';
import prisma from '../../config/db.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';

/**
 * Upload a file buffer server-side to Cloudinary and attach it to a product.
 * Keeps Cloudinary credentials exclusively on the server.
 */
export async function uploadProductImage(shopId, productId, file) {
  if (!file || !file.buffer) throw new BadRequestError('No image file provided');

  const product = await prisma.product.findFirst({
    where: { id: productId, shopId },
  });
  if (!product) throw new NotFoundError('Product not found');

  const folder = `shops/${shopId}/products`;

  const uploaded = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(file.buffer);
  });

  const existingCount = await prisma.productImage.count({ where: { productId } });
  const isPrimary = existingCount === 0;

  return prisma.productImage.create({
    data: {
      productId,
      publicId: uploaded.public_id,
      url: uploaded.secure_url,
      isPrimary,
    },
  });
}

/**
 * Mark an image as the primary image for its product.
 */
export async function setPrimaryImage(shopId, imageId) {
  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    include: { product: true },
  });
  if (!image || image.product.shopId !== shopId) {
    throw new NotFoundError('Image not found');
  }

  return prisma.$transaction(async (tx) => {
    await tx.productImage.updateMany({
      where: { productId: image.productId },
      data: { isPrimary: false },
    });
    return tx.productImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    });
  });
}

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

  // Only allow attaching assets that live under this shop's Cloudinary folder.
  const expectedPrefix = `shops/${shopId}/`;
  if (!data.publicId.startsWith(expectedPrefix)) {
    throw new BadRequestError('Image does not belong to this shop');
  }

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
