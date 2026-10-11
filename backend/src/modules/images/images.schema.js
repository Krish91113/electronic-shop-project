import { z } from 'zod';

export const signedUploadSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
  }),
});

export const attachImageSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    publicId: z.string().min(1),
    url: z.string().url(),
    isPrimary: z.boolean().optional(),
  }),
});

export const removeImageSchema = z.object({
  params: z.object({
    imageId: z.string().uuid(),
  }),
});
