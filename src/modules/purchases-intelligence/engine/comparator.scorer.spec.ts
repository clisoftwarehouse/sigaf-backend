import { scoreComparator } from './comparator.scorer';

const NOW = new Date('2026-06-09T00:00:00Z');

describe('scoreComparator', () => {
  it('should return empty array when no candidates are provided', () => {
    expect(scoreComparator({ productId: 'p1', quantity: 10, candidates: [], asOf: NOW })).toEqual([]);
  });

  it('should pick the cheapest supplier when other dimensions are tied', () => {
    const result = scoreComparator({
      productId: 'p1',
      quantity: 10,
      asOf: NOW,
      candidates: [
        {
          supplierId: 'a',
          supplierName: 'A',
          netCostUsd: 10,
          availableQty: 100,
          lotExpiryDate: new Date('2027-01-01'),
          creditDays: 30,
          deliveryDays: 2,
        },
        {
          supplierId: 'b',
          supplierName: 'B',
          netCostUsd: 12,
          availableQty: 100,
          lotExpiryDate: new Date('2027-01-01'),
          creditDays: 30,
          deliveryDays: 2,
        },
      ],
    });
    expect(result[0].supplierId).toBe('a');
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
  });

  it('should penalize partial availability with proportional score', () => {
    const result = scoreComparator({
      productId: 'p1',
      quantity: 100,
      asOf: NOW,
      candidates: [
        {
          supplierId: 'cheap-short',
          supplierName: 'Cheap Short',
          netCostUsd: 8,
          availableQty: 20, // solo cubre 20%
          lotExpiryDate: new Date('2027-01-01'),
          creditDays: 30,
          deliveryDays: 2,
        },
        {
          supplierId: 'avg-full',
          supplierName: 'Avg Full',
          netCostUsd: 10,
          availableQty: 100, // cubre completo
          lotExpiryDate: new Date('2027-01-01'),
          creditDays: 30,
          deliveryDays: 2,
        },
      ],
    });
    // El que cubre completo + 25% más caro vs el barato con disponibilidad
    // partial. Cost = 0.50, Avail = 0.15 — perder 80% de disponibilidad
    // (0.12 puntos) vs ganar 20% en costo (0.10 puntos): el full gana.
    expect(result[0].supplierId).toBe('avg-full');
  });

  it('should score expiry as 0 below 90 days and 1 above 180 days, linear in between', () => {
    const close = scoreComparator({
      productId: 'p1',
      quantity: 1,
      asOf: NOW,
      candidates: [
        {
          supplierId: 'close',
          supplierName: 'C',
          netCostUsd: 10,
          availableQty: 1,
          lotExpiryDate: new Date('2026-08-01'), // ~53 días → 0
          creditDays: 0,
          deliveryDays: 1,
        },
      ],
    });
    expect(close[0].components.expiry).toBe(0);

    const far = scoreComparator({
      productId: 'p1',
      quantity: 1,
      asOf: NOW,
      candidates: [
        {
          supplierId: 'far',
          supplierName: 'F',
          netCostUsd: 10,
          availableQty: 1,
          lotExpiryDate: new Date('2027-06-01'), // ~357 días → 1
          creditDays: 0,
          deliveryDays: 1,
        },
      ],
    });
    expect(far[0].components.expiry).toBe(1);
  });

  it('should give higher credit score to suppliers offering more credit days', () => {
    const result = scoreComparator({
      productId: 'p1',
      quantity: 1,
      asOf: NOW,
      candidates: [
        {
          supplierId: 'a',
          supplierName: 'A',
          netCostUsd: 10,
          availableQty: 1,
          lotExpiryDate: new Date('2027-01-01'),
          creditDays: 60, // más crédito → 1
          deliveryDays: 1,
        },
        {
          supplierId: 'b',
          supplierName: 'B',
          netCostUsd: 10,
          availableQty: 1,
          lotExpiryDate: new Date('2027-01-01'),
          creditDays: 30, // mitad
          deliveryDays: 1,
        },
      ],
    });
    const a = result.find((r) => r.supplierId === 'a')!;
    const b = result.find((r) => r.supplierId === 'b')!;
    expect(a.components.credit).toBe(1);
    expect(b.components.credit).toBe(0.5);
  });

  it('should prefer suppliers with fewer delivery days', () => {
    const result = scoreComparator({
      productId: 'p1',
      quantity: 1,
      asOf: NOW,
      candidates: [
        {
          supplierId: 'fast',
          supplierName: 'Fast',
          netCostUsd: 10,
          availableQty: 1,
          lotExpiryDate: new Date('2027-01-01'),
          creditDays: 30,
          deliveryDays: 1, // más rápido → 1
        },
        {
          supplierId: 'slow',
          supplierName: 'Slow',
          netCostUsd: 10,
          availableQty: 1,
          lotExpiryDate: new Date('2027-01-01'),
          creditDays: 30,
          deliveryDays: 5, // mitad
        },
      ],
    });
    const fast = result.find((r) => r.supplierId === 'fast')!;
    const slow = result.find((r) => r.supplierId === 'slow')!;
    expect(fast.components.delivery).toBe(1);
    expect(slow.components.delivery).toBe(0.2);
    expect(fast.score).toBeGreaterThan(slow.score);
  });
});
