import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../src/config/db.js';
import { previewReceive } from '../src/modules/stockUnits/stockUnits.service.js';
import { computeModelKey } from '../src/utils/modelKey.js';
import { validateImei } from '../src/utils/imei.js';

describe('Phase 2 - Stock Units & Model Grouping Unit Tests', () => {
  beforeEach(() => {
    vi.spyOn(prisma.stockUnit, 'findMany').mockResolvedValue([]);
  });

  it('computes modelKey correctly and collapses spaces', () => {
    const key = computeModelKey({
      brand: 'Oppo ',
      model: '  A6x',
      variant: '4/64  ',
      color: ' Ice Blue ',
    });
    expect(key).toBe('oppo|a6x|4/64|ice blue');
  });

  it('rejects duplicate IMEIs within the same batch during preview', async () => {
    const units = [
      { imei1: '865796081696319' },
      { imei1: '865796081696319' }, // duplicate in batch
    ];

    // Mock prisma lookup
    const preview = await previewReceive('fake-shop-id', units);
    expect(preview.duplicatesInBatch.length).toBe(1);
    expect(preview.valid.length).toBe(1);
  });

  it('identifies invalid Luhn checksum in batch preview', async () => {
    const units = [
      { imei1: '865796081668730' }, // valid
      { imei1: '865796081668731' }, // invalid Luhn
    ];

    const preview = await previewReceive('fake-shop-id', units);
    expect(preview.invalid.length).toBe(1);
    expect(preview.valid.length).toBe(1);
  });

  it('allows Luhn override when explicitly set for old/clone devices', async () => {
    const units = [
      { imei1: '865796081668731', allowLuhnOverride: true },
    ];

    const preview = await previewReceive('fake-shop-id', units);
    expect(preview.invalid.length).toBe(0);
    expect(preview.valid.length).toBe(1);
  });

  it('rejects duplicate model creation with 409 ConflictError and existingProductId', async () => {
    const { createProduct } = await import('../src/modules/products/products.service.js');
    vi.spyOn(prisma.product, 'findFirst').mockResolvedValueOnce({
      id: 'existing-p-1',
      name: 'Oppo A6x 4/64 Ice Blue',
      modelKey: 'oppo|a6x|4/64|ice blue',
    });

    await expect(
      createProduct('shop-1', {
        name: 'Oppo A6x 4/64 Ice Blue',
        brand: 'Oppo',
        model: 'A6x',
        variant: '4/64',
        color: 'Ice Blue',
        purchaseCost: 16500,
      }, 'user-1')
    ).rejects.toThrow('A product model variant with this brand, model, variant, and color already exists');
  });

  it('blocks direct quantity adjustment for serialized products', async () => {
    const { adjustStock } = await import('../src/modules/inventory/inventory.service.js');
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb) => {
      return cb({
        product: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'p-serialized',
            name: 'Oppo A6x',
            trackSerial: true,
          }),
        },
      });
    });

    await expect(
      adjustStock('shop-1', {
        productId: 'p-serialized',
        quantityDelta: 5,
        movementType: 'CORRECTION',
      }, 'user-1')
    ).rejects.toThrow('Direct quantity adjustment is not allowed for serialized products');
  });
});
