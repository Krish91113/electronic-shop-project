import { z } from 'zod';

const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  unitSellingPrice: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).optional().default(0),
  serialNumber: z.string().trim().max(100).optional().nullable(),
});

const paymentMethodSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
  z.enum(['CASH', 'UPI', 'CARD', 'OTHER'])
);

export const createSaleSchema = z.object({
  body: z.object({
    items: z.array(saleItemSchema).min(1),
    paymentMethod: paymentMethodSchema,
    paymentReference: z.string().optional(),
    customerName: z.string().trim().max(100).optional().nullable(),
    customerPhone: z.string().trim().max(30).optional().nullable(),
    notes: z.string().optional(),
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
        quantity: z.number().int().min(1),
        reason: z.string().optional(),
      })
    ).min(1),
  }),
});
