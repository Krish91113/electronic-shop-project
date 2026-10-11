import { z } from 'zod';

export const createTaxCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    rate: z.number().min(0, 'Rate must be ≥ 0').max(100, 'Rate must be ≤ 100'),
    isDefault: z.boolean().optional(),
  }),
});

export const updateTaxCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    rate: z.number().min(0).max(100).optional(),
    isDefault: z.boolean().optional(),
  }),
  params: z.object({
    tcId: z.string().uuid('Invalid tax category id'),
  }),
});
