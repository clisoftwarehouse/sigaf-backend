import { calculateNetCost } from './net-cost.calculator';

describe('calculateNetCost', () => {
  it('should return same price across scenarios when no discounts apply retorna el mismo precio en los 3 escenarios', () => {
    const r = calculateNetCost({
      basePriceUsd: 100,
      drugstoreCondition: null,
      labCondition: null,
      totalPurchaseUsd: 0,
      totalUnits: 0,
    });
    expect(r.conservative).toBe(100);
    expect(r.commercial).toBe(100);
    expect(r.financial).toBe(100);
    expect(r.appliedDiscounts).toMatchObject({
      cabeceraPct: 0,
      linealPct: 0,
      volumenPct: 0,
      escalaPct: 0,
      prontoPagoPct: 0,
    });
  });

  it('should apply cabecera and lineal multiplicatively (not additively) in conservative', () => {
    const r = calculateNetCost({
      basePriceUsd: 100,
      drugstoreCondition: {
        cabeceraPct: 10,
        volumenPct: 0,
        prontoPagoPct: 0,
        volumenMinUsd: null,
        volumenMinUnits: null,
      },
      labCondition: {
        linealPct: 5,
        escalaPct: 0,
        escalaMinUnits: null,
      },
      totalPurchaseUsd: 0,
      totalUnits: 0,
    });
    // 100 * 0.90 * 0.95 = 85.5  — NO es 100 - 10 - 5 = 85
    expect(r.conservative).toBe(85.5);
    expect(r.commercial).toBe(85.5);
    expect(r.financial).toBe(85.5);
  });

  it('should apply volumen discount only when USD threshold is met', () => {
    const dc = {
      cabeceraPct: 0,
      volumenPct: 5,
      prontoPagoPct: 0,
      volumenMinUsd: 1000,
      volumenMinUnits: null,
    };
    const below = calculateNetCost({
      basePriceUsd: 100,
      drugstoreCondition: dc,
      labCondition: null,
      totalPurchaseUsd: 500, // por debajo del umbral
      totalUnits: 0,
    });
    expect(below.appliedDiscounts.volumenPct).toBe(0);
    expect(below.commercial).toBe(100);

    const above = calculateNetCost({
      basePriceUsd: 100,
      drugstoreCondition: dc,
      labCondition: null,
      totalPurchaseUsd: 1500, // sobre el umbral
      totalUnits: 0,
    });
    expect(above.appliedDiscounts.volumenPct).toBe(5);
    expect(above.commercial).toBe(95);
  });

  it('should apply escala discount only when units threshold is met', () => {
    const lc = { linealPct: 0, escalaPct: 8, escalaMinUnits: 100 };

    const below = calculateNetCost({
      basePriceUsd: 100,
      drugstoreCondition: null,
      labCondition: lc,
      totalPurchaseUsd: 0,
      totalUnits: 50,
    });
    expect(below.appliedDiscounts.escalaPct).toBe(0);

    const above = calculateNetCost({
      basePriceUsd: 100,
      drugstoreCondition: null,
      labCondition: lc,
      totalPurchaseUsd: 0,
      totalUnits: 150,
    });
    expect(above.appliedDiscounts.escalaPct).toBe(8);
    expect(above.commercial).toBe(92);
  });

  it('should apply pronto pago only on the financial scenario', () => {
    const r = calculateNetCost({
      basePriceUsd: 100,
      drugstoreCondition: {
        cabeceraPct: 0,
        volumenPct: 0,
        prontoPagoPct: 3,
        volumenMinUsd: null,
        volumenMinUnits: null,
      },
      labCondition: null,
      totalPurchaseUsd: 0,
      totalUnits: 0,
    });
    expect(r.commercial).toBe(100);
    expect(r.financial).toBe(97);
  });

  it('should clamp negative pcts to 0 and pcts above 100 to 100', () => {
    const r = calculateNetCost({
      basePriceUsd: 100,
      drugstoreCondition: {
        cabeceraPct: -5, // se ignora
        volumenPct: 0,
        prontoPagoPct: 150, // se clampa a 100 → final = 0
        volumenMinUsd: null,
        volumenMinUnits: null,
      },
      labCondition: null,
      totalPurchaseUsd: 0,
      totalUnits: 0,
    });
    expect(r.appliedDiscounts.cabeceraPct).toBe(-5); // se guarda lo que vino para auditoría
    expect(r.commercial).toBe(100); // pero no afectó
    expect(r.financial).toBe(0); // pronto pago 100% = costo 0
  });
});
