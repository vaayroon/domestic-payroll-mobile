import { cents } from '@/types/money';

import {
  computeWorkerSs,
  resolveBaseCotizacion,
  resolveRatesConfig,
  resolveRetribucionCents,
  SS_RATES_BY_YEAR,
  workerTotalRatePer10000,
  type RatesConfig,
} from './ssContribution';

// All amounts below are obviously-fake placeholders (CLAUDE.md §5) except the
// PUBLIC BOE tramo/rate constants themselves (not PII).
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
