import { z } from 'zod';

export const updateShopSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    contactPhone: z.string().optional().nullable(),
    alternatePhone: z.string().optional().nullable(),
    contactEmail: z.string().email().optional().nullable(),
    address: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    stateCode: z.string().optional().nullable(),
    gstin: z.string().optional().nullable(),
    bankName: z.string().optional().nullable(),
    bankAccountNo: z.string().optional().nullable(),
    bankIfsc: z.string().optional().nullable(),
    bankBranch: z.string().optional().nullable(),
    upiId: z.string().optional().nullable(),
    termsAndConditions: z.string().optional().nullable(),
    brandsServiced: z.any().optional().nullable(),
    tagline: z.string().optional().nullable(),
    warrantyNote: z.string().optional().nullable(),
    pricesIncludeTax: z.boolean().optional(),
    timezone: z.string().optional(),
    invoicePrefix: z.string().min(1).max(10).optional(),
    invoiceFooter: z.string().optional().nullable(),
    logoUrl: z.string().url().optional().nullable(),
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
