import { z } from 'zod';

const optionalCleanString = z
  .string()
  .optional()
  .nullable()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || (typeof v === 'string' && !v.trim())) return null;
    return v.trim();
  });

const optionalTaxCategoryId = z
  .string()
  .optional()
  .nullable()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === 'none' || v === 'null' || v === 'undefined' || (typeof v === 'string' && !v.trim())) return null;
    return typeof v === 'string' ? v.trim() : v;
  })
  .pipe(z.string().uuid().nullable().optional());

const optionalPrice = z.preprocess((v) => {
  if (v === undefined) return undefined;
  if (v === null || v === '' || (typeof v === 'string' && !v.trim())) return null;
  return Number(v);
}, z.number().min(0, 'Selling price cannot be negative').nullable().optional());

const optionalInteger = z.preprocess((v) => {
  if (v === undefined) return undefined;
  if (v === null || v === '' || (typeof v === 'string' && !v.trim())) return undefined;
  return Number(v);
}, z.number().int().min(0).optional());

export const createProductSchema = z.object({
  body: z.object({
    barcode: optionalCleanString,
    name: z.string().min(1, 'Product name is required'),
    brand: optionalCleanString,
    model: optionalCleanString,
    category: optionalCleanString,
    description: optionalCleanString,
    purchaseCost: z.coerce.number().min(0, 'Purchase cost cannot be negative'),
    defaultSellingPrice: optionalPrice,
    pricingRule: z
      .object({
        threshold: z.coerce.number().optional(),
        addend: z.coerce.number().optional(),
        multiplier: z.coerce.number().optional(),
      })
      .optional()
      .nullable(),
    lowStockThreshold: optionalInteger,
    warranty: optionalCleanString,
    taxCategoryId: optionalTaxCategoryId,
    isPublished: z.boolean().optional(),
    initialStock: optionalInteger,
  }),
});

export const updateProductSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    barcode: optionalCleanString,
    name: z.string().min(1, 'Product name is required').optional(),
    brand: optionalCleanString,
    model: optionalCleanString,
    category: optionalCleanString,
    description: optionalCleanString,
    purchaseCost: z.coerce.number().min(0, 'Purchase cost cannot be negative').optional(),
    defaultSellingPrice: optionalPrice,
    pricingRule: z
      .object({
        threshold: z.coerce.number().optional(),
        addend: z.coerce.number().optional(),
        multiplier: z.coerce.number().optional(),
      })
      .optional()
      .nullable(),
    lowStockThreshold: optionalInteger,
    warranty: optionalCleanString,
    taxCategoryId: optionalTaxCategoryId,
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
