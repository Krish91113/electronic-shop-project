import { z } from 'zod';

export const updateShopSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    contactPhone: z.string().optional().nullable(),
    contactEmail: z.string().email().optional().nullable(),
    address: z.string().optional().nullable(),
    timezone: z.string().optional(),
    pricingRule: z
      .object({
        threshold: z.number().optional(),
        addend: z.number().optional(),
        multiplier: z.number().optional(),
      })
      .optional()
      .nullable(),
  }),
});
