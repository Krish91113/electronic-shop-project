import { z } from 'zod';

export const createExpenseSchema = z.object({
  body: z.object({
    category: z.string().min(1),
    amount: z.number().min(0),
    date: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const updateExpenseSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    category: z.string().min(1).optional(),
    amount: z.number().min(0).optional(),
    date: z.string().optional(),
    description: z.string().optional(),
  }),
});
