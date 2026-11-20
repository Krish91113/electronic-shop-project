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

const imeiUnitItemSchema = z.object({
  imei1: z.string().trim().min(1, 'IMEI 1 is required'),
  imei2: optionalCleanString,
  serialNumber: optionalCleanString,
  chargerNo: optionalCleanString,
  purchaseCost: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0).optional().nullable(),
  allowLuhnOverride: z.boolean().optional().default(false),
});

export const receiveStockUnitsSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    supplier: optionalCleanString,
    purchaseRef: optionalCleanString,
    purchaseCost: z.coerce.number().min(0, 'Purchase cost cannot be negative'),
    sellingPrice: z.coerce.number().min(0).optional().nullable(),
    units: z.array(imeiUnitItemSchema).min(1, 'At least one IMEI unit is required'),
  }),
});

export const previewStockUnitsSchema = z.object({
  body: z.object({
    units: z.array(imeiUnitItemSchema).min(1, 'At least one IMEI unit is required'),
  }),
});

export const listStockUnitsSchema = z.object({
  query: z.object({
    productId: z.string().uuid().optional(),
    status: z.string().optional(),
    q: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const updateStockUnitSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    chargerNo: optionalCleanString,
    notes: optionalCleanString,
    sellingPrice: z.coerce.number().min(0).optional().nullable(),
    supplier: optionalCleanString,
    purchaseRef: optionalCleanString,
    status: z.enum(['IN_STOCK', 'DAMAGED', 'RETURNED_TO_SUPPLIER', 'RESERVED']).optional(),
  }),
});
