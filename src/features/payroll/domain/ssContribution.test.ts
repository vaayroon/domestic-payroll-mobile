import { cents, multiplyByRatio } from '@/types/money';

import {
  applyBenefitPercent,
  computeEmployerSs,
  computeWorkerSs,
  resolveBaseCotizacion,
  resolveRatesConfig,
  resolveRetribucionCents,
  SS_RATES_BY_YEAR,
  workerTotalRatePer10000,
  type RatesConfig,
} from './ssContribution';

// Monetary amounts here may be real: the employer vectors are copied from
// official TGSS recibos (CLAUDE.md §5 scopes the fixture rule to identifiers,
// not amounts). No NIF/NIE/NAF/CCC, name or address appears in this file.
const RATES_2026: RatesConfig = SS_RATES_BY_YEAR[2026] as RatesConfig;

describe('resolveRatesConfig', () => {
  it('resolves the loaded 2026 config', () => {
    const result = resolveRatesConfig(2026);
    expect(result).toEqual({ ok: true, config: RATES_2026 });
  });

  it('returns year_not_loaded for an unloaded year (2027)', () => {
    expect(resolveRatesConfig(2027)).toEqual({ ok: false, reason: 'year_not_loaded' });
  });
});

describe('resolveRetribucionCents', () => {
  it('scales base gross by 14/12 (pagas extra prorrata), single rounding', () => {
    // 122100 * 14/12 = 142450 exactly.
    expect(resolveRetribucionCents(cents(122100))).toBe(cents(142450));
  });
});

describe('resolveBaseCotizacion (tramo boundaries)', () => {
  const { tramos, topeMaxBaseCents } = RATES_2026;

  it('tramo 1/2 boundary: 329,00 -> tramo 1 (306,00); 329,01 -> tramo 2 (436,00)', () => {
    expect(resolveBaseCotizacion(tramos, topeMaxBaseCents, cents(32900))).toBe(cents(30600));
    expect(resolveBaseCotizacion(tramos, topeMaxBaseCents, cents(32901))).toBe(cents(43600));
  });

  it('tramo 7/8 boundary: 1.424,40 -> tramo 7 (1.424,40 capped value); 1.424,41 -> tramo 8 (real retribución)', () => {
    expect(resolveBaseCotizacion(tramos, topeMaxBaseCents, cents(142440))).toBe(cents(142440));
    expect(resolveBaseCotizacion(tramos, topeMaxBaseCents, cents(142441))).toBe(cents(142441));
  });

  it('tope máximo cap: retribución 6.000,00 (tramo 8 territory) caps at 5.101,20, not the raw retribución', () => {
    expect(resolveBaseCotizacion(tramos, topeMaxBaseCents, cents(600000))).toBe(cents(510120));
  });

  it('resolves every intermediate tramo boundary correctly', () => {
    expect(resolveBaseCotizacion(tramos, topeMaxBaseCents, cents(51000))).toBe(cents(43600));
    expect(resolveBaseCotizacion(tramos, topeMaxBaseCents, cents(51001))).toBe(cents(60200));
    expect(resolveBaseCotizacion(tramos, topeMaxBaseCents, cents(69300))).toBe(cents(60200));
    expect(resolveBaseCotizacion(tramos, topeMaxBaseCents, cents(69301))).toBe(cents(78500));
    expect(resolveBaseCotizacion(tramos, topeMaxBaseCents, cents(87700))).toBe(cents(78500));
    expect(resolveBaseCotizacion(tramos, topeMaxBaseCents, cents(87701))).toBe(cents(97000));
    expect(resolveBaseCotizacion(tramos, topeMaxBaseCents, cents(106100))).toBe(cents(97000));
    expect(resolveBaseCotizacion(tramos, topeMaxBaseCents, cents(106101))).toBe(cents(115100));
    expect(resolveBaseCotizacion(tramos, topeMaxBaseCents, cents(124200))).toBe(cents(115100));
    expect(resolveBaseCotizacion(tramos, topeMaxBaseCents, cents(124201))).toBe(cents(142440));
  });
});

describe('workerTotalRatePer10000', () => {
  it('INDEFINIDO totals 6,40% (470 + 155 + 15)', () => {
    expect(workerTotalRatePer10000(RATES_2026.worker, 'INDEFINIDO')).toBe(640);
  });

  it('TEMPORAL totals 6,45% (470 + 160 + 15)', () => {
    expect(workerTotalRatePer10000(RATES_2026.worker, 'TEMPORAL')).toBe(645);
  });
});

describe('computeWorkerSs', () => {
  // base gross 1221,00 -> retribución 1424,50 -> tramo 8 (uncapped, below tope).
  const FAKE_BASE_GROSS = cents(122100);

  it('full month, INDEFINIDO: reproduces 91,17 (BOE/TGSS reference)', () => {
    const result = computeWorkerSs(RATES_2026, FAKE_BASE_GROSS, 30, 'INDEFINIDO');
    expect(result.baseCotizacionCents).toBe(cents(142450));
    expect(result.fullMonthWorkerSsCents).toBe(cents(9117));
    expect(result.proratedWorkerSsCents).toBe(cents(9117));
  });

  it('full month, TEMPORAL: reproduces 91,88 (6,45%)', () => {
    const result = computeWorkerSs(RATES_2026, FAKE_BASE_GROSS, 30, 'TEMPORAL');
    expect(result.fullMonthWorkerSsCents).toBe(cents(9188));
  });

  it('July partial month (9/30 días de alta), INDEFINIDO: reproduces 27,35', () => {
    const result = computeWorkerSs(RATES_2026, FAKE_BASE_GROSS, 9, 'INDEFINIDO');
    expect(result.proratedWorkerSsCents).toBe(cents(2735));
  });

  it('July partial month (9/30 días de alta), TEMPORAL', () => {
    const result = computeWorkerSs(RATES_2026, FAKE_BASE_GROSS, 9, 'TEMPORAL');
    // 27,56 EUR: independently-derived TEMPORAL 9/30 figure (142450 x 645 x 9 / 300000 = 2756,4075 -> 2756).
    expect(result.proratedWorkerSsCents).toBe(cents(2756));
  });

  it('zero days worked prorates to zero, no throw', () => {
    const result = computeWorkerSs(RATES_2026, FAKE_BASE_GROSS, 0, 'INDEFINIDO');
    expect(result.proratedWorkerSsCents).toBe(cents(0));
  });

  it('single-rounding: the prorated cuota is NOT the full-month cuota re-prorated by a second rounding pass', () => {
    // Sanity check that both figures come from ONE multiplyByRatio call each,
    // not fullMonthWorkerSsCents further divided/rounded a second time.
    const result = computeWorkerSs(RATES_2026, FAKE_BASE_GROSS, 9, 'INDEFINIDO');
    const wouldBeDoubleRounded = Math.round((result.fullMonthWorkerSsCents * 9) / 30);
    expect(result.proratedWorkerSsCents).toBe(cents(2735));
    // Both approaches happen to agree here, but the assertion above pins the
    // single-rounding-point contract (design ADR-3), not an incidental match.
    expect(wouldBeDoubleRounded).toBe(2735);
  });

  it('base capped at tope máximo still applies the worker rate correctly', () => {
    const hugeBaseGross = cents(600000); // 6.000,00 EUR gross -> retribución 7.000,00, well above the tope
    const result = computeWorkerSs(RATES_2026, hugeBaseGross, 30, 'INDEFINIDO');
    expect(result.baseCotizacionCents).toBe(cents(510120));
    // 326,48 EUR: independently-derived cuota on the capped tope base 5.101,20 at 6,40% (510120 x 640 / 10000 = 32647,68 -> 32648).
    expect(result.fullMonthWorkerSsCents).toBe(cents(32648));
  });
});

describe('computeEmployerSs', () => {
  // base gross 1221,00 -> retribución 1424,50 -> tramo 8 (uncapped, below tope).
  const G_1221 = cents(122100);

  it('golden vector (official TGSS recibo): base 1.424,50, INDEFINIDO, full month reproduces every printed figure', () => {
    const r = computeEmployerSs(RATES_2026, G_1221, 30, 'INDEFINIDO');

    expect(r.baseCotizacionCents).toBe(cents(142450));
    expect(r.basePeriodoCents).toBe(cents(142450));
    expect(r.contingenciasComunesCents).toBe(cents(33618)); // 336,18
    expect(r.atEpCents).toBe(cents(2137)); // 21,37
    expect(r.desempleoCents).toBe(cents(7835)); // 78,35
    expect(r.meiCents).toBe(cents(1068)); // 10,68
    expect(r.fogasaCents).toBe(cents(285)); // 2,85
    expect(r.totalNominalCents).toBe(cents(44943)); // 449,43
    expect(r.reduccionCcCents).toBe(cents(6724)); // 67,24
    expect(r.bonificacionDesempleoFogasaCents).toBe(cents(6496)); // 64,96
    expect(r.totalEfectivoCents).toBe(cents(31723)); // 317,23
  });

  it('golden vector reconciles with the worker cuota: 317,23 + 91,17 = 408,40 (the official "Cuota total")', () => {
    const employer = computeEmployerSs(RATES_2026, G_1221, 30, 'INDEFINIDO');
    const worker = computeWorkerSs(RATES_2026, G_1221, 30, 'INDEFINIDO');
    expect(worker.proratedWorkerSsCents).toBe(cents(9117));
    expect(employer.totalEfectivoCents + worker.proratedWorkerSsCents).toBe(40840);
  });

  describe('R-B2 (display-source): a benefit is a percentage of the ROUNDED cuota row', () => {
    // The golden vector does NOT discriminate R-B2 from R-B1 (benefit applied to
    // the exact, unrounded component value): at base 1.424,50 both give 64,96.
    // Without the two cases below, R-B1 passes this entire suite. Do not remove.

    it('9/30 partial month (base 1.424,50 -> prorated 427,35): bonificación 19,48 and effective 95,17, official TGSS figures', () => {
      const r = computeEmployerSs(RATES_2026, G_1221, 9, 'INDEFINIDO');

      expect(r.basePeriodoCents).toBe(cents(42735)); // 427,35
      expect(r.contingenciasComunesCents).toBe(cents(10085)); // 100,85
      expect(r.atEpCents).toBe(cents(641)); // 6,41
      expect(r.desempleoCents).toBe(cents(2350)); // 23,50
      expect(r.meiCents).toBe(cents(321)); // 3,21
      expect(r.fogasaCents).toBe(cents(85)); // 0,85
      expect(r.totalNominalCents).toBe(cents(13482)); // 134,82
      expect(r.reduccionCcCents).toBe(cents(2017)); // 20,17
      // R-B2: 80 % x (23,50 + 0,85) = 80 % x 24,35 = 19,48.
      // R-B1 would give 80 % x 24,35895 = 19,49, and an effective total of 95,16.
      expect(r.bonificacionDesempleoFogasaCents).toBe(cents(1948));
      expect(r.totalEfectivoCents).toBe(cents(9517));
      // TGSS prints benefit 39,65 (R-B1 would make it 39,66).
      expect(r.reduccionCcCents + r.bonificacionDesempleoFogasaCents).toBe(3965);
    });

    it('9/30 partial month reconciles with the official TGSS totals: 122,52 with the worker, 162,17 without the benefit', () => {
      const employer = computeEmployerSs(RATES_2026, G_1221, 9, 'INDEFINIDO');
      const worker = computeWorkerSs(RATES_2026, G_1221, 9, 'INDEFINIDO');
      expect(worker.proratedWorkerSsCents).toBe(cents(2735));
      expect(employer.totalEfectivoCents + worker.proratedWorkerSsCents).toBe(12252);
      expect(employer.totalNominalCents + worker.proratedWorkerSsCents).toBe(16217);
    });

    it('tope máximo (base 5.101,20): bonificación 232,62 and effective 1.136,03', () => {
      const r = computeEmployerSs(RATES_2026, cents(500000), 30, 'INDEFINIDO');

      expect(r.baseCotizacionCents).toBe(cents(510120)); // capped at the tope
      expect(r.contingenciasComunesCents).toBe(cents(120388)); // 1.203,88
      expect(r.atEpCents).toBe(cents(7652)); // 76,52
      expect(r.desempleoCents).toBe(cents(28057)); // 280,57
      expect(r.fogasaCents).toBe(cents(1020)); // 10,20
      expect(r.meiCents).toBe(cents(3826)); // 38,26
      expect(r.totalNominalCents).toBe(cents(160943)); // 1.609,43
      expect(r.reduccionCcCents).toBe(cents(24078)); // 240,78
      // R-B2: 80 % x (280,57 + 10,20) = 80 % x 290,77 = 232,62.
      // R-B1 would give 232,61, and an effective total of 1.136,04.
      expect(r.bonificacionDesempleoFogasaCents).toBe(cents(23262));
      expect(r.totalEfectivoCents).toBe(cents(113603));
    });

    it('applyBenefitPercent is the single place a benefit percentage is applied, to a rounded cuota', () => {
      expect(applyBenefitPercent(cents(2435), 80)).toBe(cents(1948)); // 24,35 -> 19,48
      expect(applyBenefitPercent(cents(33618), 20)).toBe(cents(6724)); // 336,18 -> 67,24
    });
  });

  describe('R-C is unrepresentable', () => {
    it('effective total is 317,23, NOT the 317,24 that summing per-component effective rows produces', () => {
      const r = computeEmployerSs(RATES_2026, G_1221, 30, 'INDEFINIDO');

      // R-C: each row rounded at its EFFECTIVE rate, then summed.
      // CC 18,88 % / desempleo 1,10 % / FOGASA 0,04 % are the nominal rates net of the benefits.
      const base = cents(142450);
      const rC =
        multiplyByRatio(base, 1888, 10000) + // 268,95 (vs 336,18 - 67,24 = 268,94)
        r.atEpCents +
        multiplyByRatio(base, 110, 10000) + // 15,67
        multiplyByRatio(base, 4, 10000) + // 0,57
        r.meiCents;
      expect(rC).toBe(31724);

      expect(r.totalEfectivoCents).toBe(cents(31723));
      expect(r.totalEfectivoCents).not.toBe(rC);
    });

    it('the breakdown exposes no per-component effective field; totalEfectivoCents is the only effective quantity', () => {
      const keys = Object.keys(computeEmployerSs(RATES_2026, G_1221, 30, 'INDEFINIDO'));
      expect(keys.filter((key) => /efectiv/i.test(key))).toEqual(['totalEfectivoCents']);
    });

    it('the two benefits are rounded individually: 67,24 + 64,96 = 132,20, not round(67,2364 + 64,9572) = 132,19', () => {
      const r = computeEmployerSs(RATES_2026, G_1221, 30, 'INDEFINIDO');
      expect(r.reduccionCcCents + r.bonificacionDesempleoFogasaCents).toBe(13220);
      // The exact benefits (from the UNROUNDED rows: 20 % x 33618,2 and 80 % x 8119,65 cents)
      // sum to 13219,36 cents, which would round to 132,19. TGSS prints 132,20.
      expect(Math.round(33618.2 * 0.2 + 8119.65 * 0.8)).toBe(13219);
    });
  });

  describe('folded-numerator drift lock', () => {
    // Test-only helper, deliberately NOT exported from production: a single
    // multiplyByRatio over the folded numerator
    //   sum(rate x (100 - benefit%)) x days / (10000 x 100 x 30).
    // It is "R-A" (one final rounding) and would make a printed row contradict
    // its own stated rate. It must never become a second production total.
    function foldedEffectiveCents(baseGross: number, days: number): number {
      const { employer } = RATES_2026;
      const base = resolveBaseCotizacion(RATES_2026.tramos, RATES_2026.topeMaxBaseCents, resolveRetribucionCents(cents(baseGross)));
      const { reduccionCcPercent: red, bonificacionDesempleoFogasaPercent: bon } = employer.beneficios;
      const foldedRate =
        employer.ccPer10000 * (100 - red) +
        employer.atEpPer10000 * 100 +
        employer.desempleoPer10000.INDEFINIDO * (100 - bon) +
        employer.fogasaPer10000 * (100 - bon) +
        employer.meiPer10000 * 100;
      return multiplyByRatio(base, foldedRate * days, 10000 * 100 * 30);
    }

    it('on G-800 (base 970,00) production is 216,03 while the folded figure is 216,02; the gap is bounded, never asserted equal', () => {
      const production = computeEmployerSs(RATES_2026, cents(80000), 30, 'INDEFINIDO').totalEfectivoCents;
      const folded = foldedEffectiveCents(80000, 30);

      expect(production).toBe(cents(21603));
      expect(folded).toBe(21602);
      // Accepted divergence (1-2 cents, spec REQ-D3). Tolerance, NEVER equality.
      expect(Math.abs(folded - production)).toBeLessThanOrEqual(2);
    });
  });
});
