import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    barcode: z.string().optional().nullable(),
    name: z.string().min(1),
    brand: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    purchaseCost: z.number().min(0),
    defaultSellingPrice: z.number().min(0).optional().nullable(),
    pricingRule: z
      .object({
        threshold: z.number().optional(),
        addend: z.number().optional(),
        multiplier: z.number().optional(),
      })
      .optional()
      .nullable(),
    lowStockThreshold: z.number().int().min(0).optional(),
    warranty: z.string().optional().nullable(),
    taxCategoryId: z.string().uuid().optional().nullable(),
    isPublished: z.boolean().optional(),
    initialStock: z.number().int().min(0).optional(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    barcode: z.string().optional().nullable(),
    name: z.string().min(1).optional(),
    brand: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    purchaseCost: z.number().min(0).optional(),
    defaultSellingPrice: z.number().min(0).optional().nullable(),
    pricingRule: z
      .object({
        threshold: z.number().optional(),
        addend: z.number().optional(),
        multiplier: z.number().optional(),
      })
      .optional()
      .nullable(),
    lowStockThreshold: z.number().int().min(0).optional(),
    warranty: z.string().optional().nullable(),
    taxCategoryId: z.string().uuid().optional().nullable(),
    isPublished: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const scanBarcodeSchema = z.object({
  body: z.object({
    barcode: z.string().min(1),
  }),
});

export const listProductsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    brand: z.string().optional(),
    isActive: z.string().optional(),
  }),
});
