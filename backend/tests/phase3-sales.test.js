import { describe, it, expect, vi } from 'vitest';
import prisma from '../src/config/db.js';
import { getSale } from '../src/modules/sales/sales.service.js';
import { splitInclusive } from '../src/utils/gst.js';
import { amountInWords } from '../src/utils/words.js';

describe('Phase 3 - Sales & Invoicing Unit Tests', () => {
  it('GST-inclusive math matches reference example (₹19,999 @ 8%)', () => {
    const res = splitInclusive(19999, 1, 0, 8, { isInterState: false });
    expect(res.gross).toBe(19999);
    expect(res.taxable).toBe(18517.59);
    expect(res.tax).toBe(1481.41);
    expect(res.cgst).toBe(740.71);
    expect(res.sgst).toBe(740.70);
    expect(res.cgst + res.sgst).toBe(1481.41);
    expect(res.unitBasePrice).toBe(18517.59);
  });

  it('inter-state GST routes 100% tax to IGST', () => {
    const res = splitInclusive(19999, 1, 0, 18, { isInterState: true });
    expect(res.gross).toBe(19999);
    expect(res.cgst).toBe(0);
    expect(res.sgst).toBe(0);
    expect(res.igst).toBe(3050.69);
  });

  it('amountInWords formats Indian currency accurately with paise', () => {
    expect(amountInWords(1220110.50)).toBe(
      'INR Twelve Lakh Twenty Thousand One Hundred Ten and Fifty paise Only'
    );
    expect(amountInWords(19999)).toBe(
      'INR Nineteen Thousand Nine Hundred Ninety Nine Only'
    );
  });

  it('enriches legacy sales with derived CGST/SGST, amountInWords, and serialNumber fallback', async () => {
    const legacySale = {
      id: 'legacy-sale-1',
      shopId: 'shop-1',
      invoiceNumber: 'TC-2025-000001',
      status: 'COMPLETED',
      subtotal: '10000.00',
      discountTotal: '0.00',
      taxTotal: '1800.00',
      totalAmount: '11800.00',
      cgstTotal: '0.00',
      sgstTotal: '0.00',
      igstTotal: '0.00',
      taxInclusive: false,
      amountInWords: null,
      roundOff: null,
      items: [
        {
          id: 'item-1',
          productId: 'p-1',
          quantity: 1,
          unitSellingPrice: '10000.00',
          taxAmount: '1800.00',
          taxRateSnapshot: '18',
          serialNumber: 'LEGACY-SERIAL-999',
          imeiSnapshot: null,
          hsnSnapshot: null,
          product: { category: 'Mobile Phones', trackSerial: true },
        },
      ],
      payments: [{ id: 'pay-1', method: 'CASH', amount: '11800.00' }],
      shop: {
        name: 'Time Centre',
        code: 'TC',
        state: 'Jharkhand',
        stateCode: '20',
      },
    };

    vi.spyOn(prisma.sale, 'findFirst').mockResolvedValue(legacySale);

    const enriched = await getSale('shop-1', 'legacy-sale-1');
    expect(enriched.cgstTotal).toBe(900);
    expect(enriched.sgstTotal).toBe(900);
    expect(enriched.amountInWords).toBe('INR Eleven Thousand Eight Hundred Only');
    expect(enriched.items[0].imeiSnapshot).toBe('LEGACY-SERIAL-999');
    expect(enriched.items[0].hsnSnapshot).toBe('8517');
    expect(enriched.items[0].cgstAmount).toBe(900);
    expect(enriched.items[0].sgstAmount).toBe(900);
  });
});
