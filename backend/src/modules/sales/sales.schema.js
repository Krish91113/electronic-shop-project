import { z } from 'zod';

const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
  unitSellingPrice: z.number().min(0),
  discountAmount: z.number().min(0).optional().default(0),
});

export const createSaleSchema = z.object({
  body: z.object({
    items: z.array(saleItemSchema).min(1),
    paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'OTHER']),
    paymentReference: z.string().optional(),
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
