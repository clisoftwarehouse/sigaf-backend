import { calculateRotation } from './rotation.calculator';

const NOW = new Date('2026-06-09T00:00:00Z');

describe('calculateRotation', () => {
  it('should return zero velocity and zero days when there are no sales and no stock', () => {
    const r = calculateRotation({ sales: [], currentStock: 0, asOf: NOW });
    expect(r.dailyVelocity).toBe(0);
    expect(r.daysOfInventory).toBe(0);
    expect(r.daysSinceLastSale).toBeNull();
    expect(r.unitsSoldInWindow).toBe(0);
  });

  it('should return Infinity days of inventory when there is stock but no sales', () => {
    const r = calculateRotation({ sales: [], currentStock: 50, asOf: NOW });
    expect(r.daysOfInventory).toBe(Infinity);
  });

  it('should count only sales inside the configured window', () => {
    const r = calculateRotation({
      sales: [
        { date: new Date('2026-06-01'), quantity: 10 }, // dentro de 90d
        { date: new Date('2026-05-15'), quantity: 5 }, // dentro
        { date: new Date('2025-12-01'), quantity: 100 }, // fuera (>90d)
      ],
      currentStock: 30,
      asOf: NOW,
      windowDays: 90,
    });
    // 15 unidades / 90 días ≈ 0.1666... → redondeado a 4
    expect(r.unitsSoldInWindow).toBe(15);
    expect(r.dailyVelocity).toBeCloseTo(0.1667, 3);
    // 30 / 0.1667 ≈ 180 días
    expect(r.daysOfInventory).toBeGreaterThan(170);
    expect(r.daysOfInventory).toBeLessThan(190);
  });

  it('should compute daysSinceLastSale from the most recent sale even if outside the window', () => {
    const r = calculateRotation({
      sales: [
        { date: new Date('2026-06-04'), quantity: 1 }, // 5 días atrás
        { date: new Date('2025-01-01'), quantity: 1 }, // muy viejo
      ],
      currentStock: 10,
      asOf: NOW,
    });
    expect(r.daysSinceLastSale).toBe(5);
  });

  it('should ignore sales with quantity <= 0 defensively', () => {
    const r = calculateRotation({
      sales: [
        { date: new Date('2026-06-01'), quantity: 10 },
        { date: new Date('2026-06-02'), quantity: -3 }, // ignorar
        { date: new Date('2026-06-03'), quantity: 0 }, // ignorar
      ],
      currentStock: 0,
      asOf: NOW,
    });
    expect(r.unitsSoldInWindow).toBe(10);
  });
});
