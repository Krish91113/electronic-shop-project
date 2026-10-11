import { z } from 'zod';

export const receiveStockSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1),
    unitCost: z.number().min(0),
    notes: z.string().optional(),
  }),
});

export const adjustStockSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    quantityDelta: z.number().int(),
    movementType: z.enum(['ADJUSTMENT', 'DAMAGE']),
    notes: z.string().optional(),
  }),
});

export const listMovementsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    productId: z.string().uuid().optional(),
    movementType: z.string().optional(),
  }),
});
