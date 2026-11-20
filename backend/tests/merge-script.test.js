import { describe, it, expect } from 'vitest';
import { computeModelKey, parseProductModel } from '../src/utils/modelKey.js';
import { validateImei } from '../src/utils/imei.js';

describe('Merge Products Logic', () => {
  it('correctly identifies duplicates and groups by modelKey', () => {
    const products = [
      {
        id: 'p1',
        name: 'A6x 4/64 Ice Blue',
        barcode: '865796081668730',
        brand: 'Oppo',
        model: 'A6x',
        purchaseCost: 16500,
        createdAt: new Date('2026-10-01'),
        salesCount: 1,
      },
      {
        id: 'p2',
        name: 'A6x 4/64 Ice Blue',
        barcode: '865796081696319',
        brand: 'Oppo',
        model: 'A6x',
        purchaseCost: 16500,
        createdAt: new Date('2026-10-02'),
        salesCount: 0,
      },
      {
        id: 'p3',
        name: 'A6x 4/64 Green',
        barcode: '868380084024212',
        brand: 'Oppo',
        model: 'A6x',
        purchaseCost: 16500,
        createdAt: new Date('2026-10-03'),
        salesCount: 0,
      },
    ];

    // Compute model keys
    const groups = new Map();
    for (const p of products) {
      const parsed = parseProductModel(p.name);
      const key = computeModelKey({
        brand: p.brand || parsed.brand,
        model: p.model || parsed.model,
        variant: parsed.variant,
        color: parsed.color,
        name: p.name,
      });

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }

    // "A6x 4/64 Ice Blue" x2 should be grouped into 1 group
    expect(groups.get('oppo|a6x|4/64|ice blue').length).toBe(2);
    // "A6x 4/64 Green" in its own group
    expect(groups.get('oppo|a6x|4/64|green').length).toBe(1);

    // Canonical product picking: p1 has sales, so it must be canonical
    const iceBlueItems = groups.get('oppo|a6x|4/64|ice blue');
    iceBlueItems.sort((a, b) => b.salesCount - a.salesCount);
    expect(iceBlueItems[0].id).toBe('p1');
    expect(iceBlueItems[1].id).toBe('p2');

    // Both barcodes are valid 15-digit IMEIs
    expect(validateImei(iceBlueItems[0].barcode).valid).toBe(true);
    expect(validateImei(iceBlueItems[1].barcode).valid).toBe(true);
  });
});
