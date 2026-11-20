import { describe, it, expect } from 'vitest';
import { cleanImei, isValidLuhn, validateImei, previewImeiBatch } from '../src/utils/imei.js';
import { amountInWords } from '../src/utils/words.js';
import { splitInclusive, addExclusive } from '../src/utils/gst.js';
import { computeModelKey, parseProductModel } from '../src/utils/modelKey.js';
import { round2 } from '../src/utils/money.js';

describe('IMEI utility', () => {
  it('validates 15-digit Luhn correct IMEIs', () => {
    // Real IMEI examples from real data:
    expect(isValidLuhn('865796081668730')).toBe(true);
    expect(isValidLuhn('865796081696319')).toBe(true);
    expect(isValidLuhn('868380084024212')).toBe(true);

    // Invalid checksum:
    expect(isValidLuhn('865796081668731')).toBe(false);

    // Invalid length:
    expect(isValidLuhn('12345')).toBe(false);
  });

  it('validates and cleans formatted IMEIs', () => {
    const res = validateImei('86-579608-166873-0');
    expect(res.valid).toBe(true);
    expect(res.cleaned).toBe('865796081668730');
  });

  it('allows Luhn override if specified', () => {
    const badChecksum = '865796081668731';
    const strictRes = validateImei(badChecksum, { strict: true, allowLuhnOverride: false });
    expect(strictRes.valid).toBe(false);

    const overrideRes = validateImei(badChecksum, { allowLuhnOverride: true });
    expect(overrideRes.valid).toBe(true);
  });

  it('previews batch with duplicates and existing units', () => {
    const existingMap = new Map([
      ['865796081668730', { status: 'SOLD', invoiceNumber: 'TC-2026-000012' }],
    ]);

    const batch = [
      { imei1: '865796081696319' }, // valid
      { imei1: '865796081668730' }, // already in shop
      { imei1: '865796081696319' }, // duplicate in batch
      { imei1: '12345' },           // invalid length
    ];

    const preview = previewImeiBatch(batch, existingMap);
    expect(preview.valid.length).toBe(1);
    expect(preview.alreadyInShop.length).toBe(1);
    expect(preview.duplicatesInBatch.length).toBe(1);
    expect(preview.invalid.length).toBe(1);
  });
});

describe('Number to Words (Indian System)', () => {
  it('converts exact amounts as required', () => {
    expect(amountInWords(0)).toBe('INR Zero Only');
    expect(amountInWords(1)).toBe('INR One Only');
    expect(amountInWords(99)).toBe('INR Ninety Nine Only');
    expect(amountInWords(100)).toBe('INR One Hundred Only');
    expect(amountInWords(1000)).toBe('INR One Thousand Only');
    expect(amountInWords(100000)).toBe('INR One Lakh Only');
    expect(amountInWords('1220110.50')).toBe(
      'INR Twelve Lakh Twenty Thousand One Hundred Ten and Fifty paise Only'
    );
    expect(amountInWords(19999)).toBe(
      'INR Nineteen Thousand Nine Hundred Ninety Nine Only'
    );
  });
});

describe('GST calculation', () => {
  it('back-calculates 8% GST inclusive correctly', () => {
    // 19,999 @ 8%
    const res = splitInclusive(19999, 1, 0, 8, { isInterState: false });
    expect(res.gross).toBe(19999);
    expect(res.taxable).toBe(18517.59);
    expect(res.tax).toBe(1481.41);
    expect(res.cgst).toBe(740.71);
    expect(res.sgst).toBe(740.70);
    expect(round2(res.cgst + res.sgst)).toBe(res.tax);
    expect(round2(res.taxable + res.tax)).toBe(res.gross);
  });

  it('back-calculates 18% GST inclusive correctly', () => {
    const res = splitInclusive(19999, 1, 0, 18, { isInterState: false });
    expect(res.gross).toBe(19999);
    expect(res.taxable).toBe(16948.31);
    expect(res.tax).toBe(3050.69);
    expect(res.cgst).toBe(1525.35);
    expect(res.sgst).toBe(1525.34);
    expect(round2(res.cgst + res.sgst)).toBe(res.tax);
    expect(round2(res.taxable + res.tax)).toBe(res.gross);
  });

  it('handles qty 2 and discount', () => {
    // 2 x 19999 - 500 = 39498
    const res = splitInclusive(19999, 2, 500, 8, { isInterState: false });
    expect(res.gross).toBe(39498);
    expect(res.taxable + res.tax).toBe(39498);
    expect(res.cgst + res.sgst).toBe(res.tax);
  });

  it('satisfies taxable + tax === gross for 1,000 random values', () => {
    for (let i = 0; i < 1000; i++) {
      const price = Math.floor(Math.random() * 100000) + 1;
      const qty = Math.floor(Math.random() * 5) + 1;
      const discount = Math.floor(Math.random() * 500);
      const rates = [0, 5, 8, 12, 18, 28];
      const rate = rates[Math.floor(Math.random() * rates.length)];
      const res = splitInclusive(price, qty, discount, rate);
      if (res.gross > 0) {
        expect(Math.round((res.taxable + res.tax) * 100) / 100).toBe(res.gross);
        expect(Math.round((res.cgst + res.sgst) * 100) / 100).toBe(res.tax);
      }
    }
  });

  it('handles inter-state IGST correctly', () => {
    const res = splitInclusive(19999, 1, 0, 18, { isInterState: true });
    expect(res.cgst).toBe(0);
    expect(res.sgst).toBe(0);
    expect(res.igst).toBe(3050.69);
  });
});

describe('Model Key and Name Parsing', () => {
  it('parses Oppo A6x 4/64 Ice Blue correctly', () => {
    const parsed = parseProductModel('Oppo A6x 4/64 Ice Blue');
    expect(parsed.brand).toBe('Oppo');
    expect(parsed.model).toBe('A6x');
    expect(parsed.variant).toBe('4/64');
    expect(parsed.color).toBe('Ice Blue');

    const key = computeModelKey({ name: 'Oppo A6x 4/64 Ice Blue' });
    expect(key).toBe('oppo|a6x|4/64|ice blue');
  });

  it('normalizes modelKey with separate fields', () => {
    const key = computeModelKey({
      brand: ' Oppo ',
      model: 'A6x  ',
      variant: ' 4/64 ',
      color: 'Ice Blue',
    });
    expect(key).toBe('oppo|a6x|4/64|ice blue');
  });
});
