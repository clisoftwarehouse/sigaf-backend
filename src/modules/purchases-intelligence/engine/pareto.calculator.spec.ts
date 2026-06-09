import { calculatePareto } from './pareto.calculator';

describe('calculatePareto', () => {
  it('should return empty array when input is empty', () => {
    expect(calculatePareto([])).toEqual([]);
  });

  it('should mark nobody as Pareto when all inputs are zero', () => {
    const r = calculatePareto([
      { productId: 'a', unitsSold: 0, marginUsd: 0 },
      { productId: 'b', unitsSold: 0, marginUsd: 0 },
    ]);
    expect(r.every((p) => !p.isPareto)).toBe(true);
  });

  it('should mark as Pareto the products covering 80% of the accumulated score', () => {
    // a domina ambas dimensiones, b es mediano, c es nada.
    const r = calculatePareto([
      { productId: 'a', unitsSold: 100, marginUsd: 1000 },
      { productId: 'b', unitsSold: 20, marginUsd: 200 },
      { productId: 'c', unitsSold: 1, marginUsd: 10 },
    ]);
    const map = Object.fromEntries(r.map((x) => [x.productId, x]));
    expect(map.a.isPareto).toBe(true);
    expect(map.c.isPareto).toBe(false);
    // b puede o no ser Pareto dependiendo del threshold — lo importante es
    // que el score sea menor que el de a y mayor que el de c.
    expect(map.b.paretoScore).toBeLessThan(map.a.paretoScore);
    expect(map.b.paretoScore).toBeGreaterThan(map.c.paretoScore);
  });

  it('should preserve the input order in the output', () => {
    const r = calculatePareto([
      { productId: 'z', unitsSold: 1, marginUsd: 1 },
      { productId: 'a', unitsSold: 100, marginUsd: 100 },
      { productId: 'm', unitsSold: 50, marginUsd: 50 },
    ]);
    expect(r.map((x) => x.productId)).toEqual(['z', 'a', 'm']);
  });

  it('should give equal score to products dominating one dimension each (50/50 weights)', () => {
    const r = calculatePareto([
      { productId: 'units-king', unitsSold: 100, marginUsd: 0 },
      { productId: 'margin-king', unitsSold: 0, marginUsd: 100 },
    ]);
    const a = r.find((x) => x.productId === 'units-king')!;
    const b = r.find((x) => x.productId === 'margin-king')!;
    // Ambos deberían tener exactamente el mismo paretoScore = 0.5
    expect(a.paretoScore).toBe(b.paretoScore);
    expect(a.paretoScore).toBe(0.5);
  });
});
