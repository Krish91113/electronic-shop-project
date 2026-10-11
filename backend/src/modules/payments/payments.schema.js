import { z } from 'zod';

export const createPaymentSchema = z.object({
  body: z.object({
    saleId: z.string().uuid(),
    method: z.enum(['CASH', 'UPI', 'CARD', 'OTHER']),
    amount: z.number().min(0),
    reference: z.string().optional(),
  }),
});
