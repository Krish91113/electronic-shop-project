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

const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  unitSellingPrice: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).optional().default(0),
  serialNumber: optionalCleanString,
  stockUnitIds: z.array(z.string().uuid()).optional(),
  imeis: z.array(z.string().trim()).optional(),
});

const paymentMethodSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() : v),
  z.string().min(1, 'Payment method is required')
);

export const createSaleSchema = z.object({
  body: z.object({
    items: z.array(saleItemSchema).min(1),
    paymentMethod: paymentMethodSchema,
    paymentReference: optionalCleanString,
    customerName: optionalCleanString,
    customerPhone: optionalCleanString,
    customerAddress: optionalCleanString,
    customerGstin: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v && v.trim() ? v.trim().toUpperCase() : null)),
    customerAadhaar: z
      .string()
      .optional()
      .nullable()
      .transform((v) => {
        if (!v || !v.trim()) return null;
        const cleaned = v.replace(/\D/g, '');
        // Store last 4 digits
        return cleaned.length >= 4 ? cleaned.slice(-4) : cleaned;
      }),
    customerState: optionalCleanString,
    customerStateCode: optionalCleanString,
    placeOfSupply: optionalCleanString,
    paymentMode: optionalCleanString,
    notes: optionalCleanString,
  }),
});

export const listSalesSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

export const returnSaleSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    items: z.array(
      z.object({
        saleItemId: z.string().uuid(),
        stockUnitId: z.string().uuid().optional(),
        quantity: z.number().int().min(1),
        reason: optionalCleanString,
      })
    ).min(1),
  }),
});
