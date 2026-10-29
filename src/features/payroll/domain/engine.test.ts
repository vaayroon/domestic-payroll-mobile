import { cents } from '@/types/money';

import {
  calculatePayrollRun,
  daysInMonth,
  daysWorkedInInterval,
  proratedAmount,
  resolveEffectivePeriod,
  resolveEffectivePeriodFromRange,
  resolveExtraPayCents,
  SALARY_DEVENGO_DIVISOR,
  semesterBounds,
  type PayrollInput,
} from './engine';
import { computeEmployerSsFromBase, computeWorkerSs, SS_DIVISOR, SS_RATES_BY_YEAR, type RatesConfig } from './ssContribution';

// All amounts below are obviously-fake placeholders (CLAUDE.md §5) -- never
// real salary figures. `RATES_2026` itself is public BOE data, not PII.
const RATES_2026: RatesConfig = SS_RATES_BY_YEAR[2026] as RatesConfig;
const FAKE_BASE_GROSS = cents(90000); // 900,00 EUR
const FAKE_BASE_GROSS_DIV6 = cents(120000); // 1200,00 EUR -- exactly divisible by 6
// Design ADR proof number: retribución = 1221,00 x14/12 = 1424,50 -> tramo 8, uncapped.
const FAKE_BASE_GROSS_SS_PROOF = cents(122100); // 1221,00 EUR

function baseInput(overrides: Partial<PayrollInput> = {}): PayrollInput {
  return {
    baseGrossCents: FAKE_BASE_GROSS,
    ratesConfig: RATES_2026,
    contractType: 'INDEFINIDO',
    periodYear: 2026,
    periodMonth: 7,
    altaDate: null,
    bajaDate: null,
    extraPayMode: 'EXCLUDE',
    ...overrides,
  };
}

describe('SALARY_DEVENGO_DIVISOR', () => {
  it('is numerically equal to SS_DIVISOR (drift-lock invariant, design ADR-1)', () => {
    // Distinct legal bases (labor-law devengo vs. TGSS contribution base),
    // but this equality is REQUIRED for the receipt's basePeriodo x tipo =
    // cuota reconciliation to hold. If this ever fails, salary and SS
    // proration have silently diverged.
    expect(SALARY_DEVENGO_DIVISOR).toBe(SS_DIVISOR);
  });
});

describe('daysInMonth', () => {
  it('returns 31 for July', () => {
    expect(daysInMonth(2026, 7)).toBe(31);
  });

  it('returns 30 for April', () => {
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('returns 29 for February in a leap year (2028)', () => {
    expect(daysInMonth(2028, 2)).toBe(29);
  });

  it('returns 28 for February in a non-leap year (2026)', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
  });
});

describe('resolveEffectivePeriod', () => {
  it('resolves a mid-month alta: 2026-07-23 in July 2026 => 9/31', () => {
    const result = resolveEffectivePeriod(2026, 7, '2026-07-23', null);
    expect(result.startDay).toBe(23);
    expect(result.endDay).toBe(31);
    expect(result.daysWorked).toBe(9);
    expect(result.daysInMonth).toBe(31);
    expect(result.prorated).toBe(true);
  });

  it('resolves a mid-month baja', () => {
    const result = resolveEffectivePeriod(2026, 7, null, '2026-07-10');
    expect(result.startDay).toBe(1);
    expect(result.endDay).toBe(10);
    expect(result.daysWorked).toBe(10);
    expect(result.prorated).toBe(true);
  });

  it('alta+baja within the same month', () => {
    const result = resolveEffectivePeriod(2026, 7, '2026-07-05', '2026-07-15');
    expect(result.daysWorked).toBe(11);
    expect(result.prorated).toBe(true);
  });

  it('alta on the 1st and baja on the last day => full month, not prorated', () => {
    const result = resolveEffectivePeriod(2026, 7, '2026-07-01', '2026-07-31');
    expect(result.daysWorked).toBe(31);
    expect(result.prorated).toBe(false);
  });

  it('alta/baja both outside the period (well before/after) => full month, not prorated', () => {
    const result = resolveEffectivePeriod(2026, 7, '2026-01-01', '2026-12-31');
    expect(result.daysWorked).toBe(31);
    expect(result.prorated).toBe(false);
  });

  it('both alta and baja null => full month, not prorated', () => {
    const result = resolveEffectivePeriod(2026, 7, null, null);
    expect(result.daysWorked).toBe(31);
    expect(result.prorated).toBe(false);
  });

  it('alta after period end => zero days, no throw', () => {
    const result = resolveEffectivePeriod(2026, 7, '2026-08-01', null);
    expect(result.daysWorked).toBe(0);
    expect(result.endDay).toBe(0);
  });

  it('baja before period start => zero days, no throw', () => {
    const result = resolveEffectivePeriod(2026, 7, null, '2026-06-30');
    expect(result.daysWorked).toBe(0);
    expect(result.endDay).toBe(0);
  });
});

describe('resolveEffectivePeriodFromRange', () => {
  it('full range covering the whole month => full month, not prorated', () => {
    const result = resolveEffectivePeriodFromRange(2026, 6, '2026-06-01', '2026-06-30');
    expect(result.daysWorked).toBe(30);
    expect(result.daysInMonth).toBe(30);
    expect(result.prorated).toBe(false);
  });

  it('partial start only (open end) => clips at the start', () => {
    const result = resolveEffectivePeriodFromRange(2026, 6, '2026-06-10', null);
    expect(result.startDay).toBe(10);
    expect(result.endDay).toBe(30);
    expect(result.daysWorked).toBe(21);
    expect(result.prorated).toBe(true);
  });

  it('partial end only (open start) => clips at the end', () => {
    const result = resolveEffectivePeriodFromRange(2026, 6, null, '2026-06-20');
    expect(result.startDay).toBe(1);
    expect(result.endDay).toBe(20);
    expect(result.daysWorked).toBe(20);
    expect(result.prorated).toBe(true);
  });

  it('mid-month-only range clips both ends (spec Scenario 6): daysWorked=11, daysInMonth=30', () => {
    const result = resolveEffectivePeriodFromRange(2026, 6, '2026-06-10', '2026-06-20');
    expect(result.daysWorked).toBe(11);
    expect(result.daysInMonth).toBe(30);
    expect(result.prorated).toBe(true);
  });

  it('single-day range (spec Scenario 7): daysWorked=1', () => {
    const result = resolveEffectivePeriodFromRange(2026, 6, '2026-06-15', '2026-06-15');
    expect(result.daysWorked).toBe(1);
  });

  it('range fully outside the target month (spec Scenario 8): daysWorked=0, no throw', () => {
    const result = resolveEffectivePeriodFromRange(2026, 6, '2026-05-01', '2026-05-31');
    expect(result.daysWorked).toBe(0);
    expect(result.endDay).toBe(0);
  });

  it('inverted range (start > end) degrades to zero-overlap, matching the alta/baja no-overlap shape', () => {
    const result = resolveEffectivePeriodFromRange(2026, 6, '2026-06-20', '2026-06-10');
    expect(result).toEqual({ startDay: 1, endDay: 0, daysWorked: 0, daysInMonth: 30, prorated: true });
  });

  it('null start and present end => same as partial-end-only', () => {
    const result = resolveEffectivePeriodFromRange(2026, 6, null, '2026-06-20');
    expect(result.daysWorked).toBe(20);
  });

  it('present start and null end => same as partial-start-only', () => {
    const result = resolveEffectivePeriodFromRange(2026, 6, '2026-06-10', null);
    expect(result.daysWorked).toBe(21);
  });

  it('both null => full month, not prorated (falls back to unbounded, same shape as resolveEffectivePeriod)', () => {
    const result = resolveEffectivePeriodFromRange(2026, 6, null, null);
    expect(result.daysWorked).toBe(30);
    expect(result.prorated).toBe(false);
  });

  it('range wider than the month clips to the full month, prorated:false', () => {
    const result = resolveEffectivePeriodFromRange(2026, 6, '2026-01-01', '2026-12-31');
    expect(result.daysWorked).toBe(30);
    expect(result.prorated).toBe(false);
  });

  it('produces identical results to resolveEffectivePeriod for the same bounds (shared helper, no drift)', () => {
    const viaAltaBaja = resolveEffectivePeriod(2026, 6, '2026-06-10', '2026-06-20');
    const viaRange = resolveEffectivePeriodFromRange(2026, 6, '2026-06-10', '2026-06-20');
    expect(viaRange).toEqual(viaAltaBaja);
  });
});

describe('proratedAmount', () => {
  it('rounds a non-evenly-divisible ratio exactly once, half-up', () => {
    // 90000 * 9 / 31 = 26129.03... => rounds to 26129.
    expect(proratedAmount(FAKE_BASE_GROSS, 9, 31)).toBe(cents(26129));
  });

  it('returns the full amount for a full-month ratio', () => {
    expect(proratedAmount(FAKE_BASE_GROSS, 31, 31)).toBe(cents(90000));
  });

  it('returns zero for a zero-days ratio without throwing', () => {
    expect(proratedAmount(FAKE_BASE_GROSS, 0, 31)).toBe(cents(0));
  });
});

describe('semesterBounds', () => {
  it('maps January-June to H1 with exact ISO bounds', () => {
    expect(semesterBounds(2026, 1)).toEqual({ startIso: '2026-01-01', endIso: '2026-06-30', which: 'H1' });
    expect(semesterBounds(2026, 6)).toEqual({ startIso: '2026-01-01', endIso: '2026-06-30', which: 'H1' });
  });

  it('maps July-December to H2 with exact ISO bounds, ending Dec 31 (not Dec 30)', () => {
    expect(semesterBounds(2026, 7)).toEqual({ startIso: '2026-07-01', endIso: '2026-12-31', which: 'H2' });
    expect(semesterBounds(2026, 12)).toEqual({ startIso: '2026-07-01', endIso: '2026-12-31', which: 'H2' });
  });

  it('H1-2026 spans exactly 181 calendar days', () => {
    const { startIso, endIso } = semesterBounds(2026, 3);
    expect(daysWorkedInInterval(null, null, startIso, endIso)).toBe(181);
  });

  it('H2-2026 spans exactly 184 calendar days (Dec-31 guard against an off-by-one Dec-30 bug)', () => {
    const { startIso, endIso } = semesterBounds(2026, 9);
    expect(daysWorkedInInterval(null, null, startIso, endIso)).toBe(184);
  });
});

describe('daysWorkedInInterval', () => {
  const H1_2026 = semesterBounds(2026, 3);

  it('alta mid-semester (worked example): 2026-06-10 => 21 days worked in H1', () => {
    expect(daysWorkedInInterval('2026-06-10', null, H1_2026.startIso, H1_2026.endIso)).toBe(21);
  });

  it('baja mid-semester', () => {
    expect(daysWorkedInInterval(null, '2026-01-10', H1_2026.startIso, H1_2026.endIso)).toBe(10);
  });

  it('alta before the semester start => full semester counted', () => {
    expect(daysWorkedInInterval('2025-01-01', null, H1_2026.startIso, H1_2026.endIso)).toBe(181);
  });

  it('both alta and baja null => full semester', () => {
    expect(daysWorkedInInterval(null, null, H1_2026.startIso, H1_2026.endIso)).toBe(181);
  });

  it('zero overlap: alta after the semester end => 0', () => {
    expect(daysWorkedInInterval('2026-07-01', null, H1_2026.startIso, H1_2026.endIso)).toBe(0);
  });

  it('zero overlap: baja before the semester start => 0', () => {
    expect(daysWorkedInInterval(null, '2025-12-31', H1_2026.startIso, H1_2026.endIso)).toBe(0);
  });
});

describe('resolveExtraPayCents', () => {
  describe('EXCLUDE mode', () => {
    it('is always zero, including in June and December', () => {
      expect(resolveExtraPayCents(baseInput({ extraPayMode: 'EXCLUDE', periodMonth: 6 }))).toBe(cents(0));
      expect(resolveExtraPayCents(baseInput({ extraPayMode: 'EXCLUDE', periodMonth: 12 }))).toBe(cents(0));
      expect(resolveExtraPayCents(baseInput({ extraPayMode: 'EXCLUDE', periodMonth: 3 }))).toBe(cents(0));
    });
  });

  describe('PRORATE mode', () => {
    it('accrues base/6 for a full month', () => {
      const input = baseInput({ baseGrossCents: FAKE_BASE_GROSS_DIV6, extraPayMode: 'PRORATE', periodMonth: 7 });
      expect(resolveExtraPayCents(input)).toBe(cents(FAKE_BASE_GROSS_DIV6 / 6));
    });

    it('scales the monthly accrual by the same day ratio as gross in a partial month', () => {
      const input = baseInput({ extraPayMode: 'PRORATE', periodMonth: 7, altaDate: '2026-07-23' });
      expect(resolveExtraPayCents(input)).toBe(cents(Math.round((FAKE_BASE_GROSS * 9) / (6 * 30))));
    });

    it('12 full months sum to exactly 2x baseGrossCents (annual invariant)', () => {
      let total = cents(0);
      for (let month = 1; month <= 12; month += 1) {
        const extra = resolveExtraPayCents(baseInput({ baseGrossCents: FAKE_BASE_GROSS_DIV6, extraPayMode: 'PRORATE', periodMonth: month }));
        total = cents(total + extra);
      }
      expect(total).toBe(cents(FAKE_BASE_GROSS_DIV6 * 2));
    });
  });

  describe('INCLUDE_IN_MONTH mode', () => {
    it('pays the full base when the entire H1 semester was worked, in June', () => {
      const input = baseInput({ extraPayMode: 'INCLUDE_IN_MONTH', periodMonth: 6, altaDate: null, bajaDate: null });
      expect(resolveExtraPayCents(input)).toBe(FAKE_BASE_GROSS);
    });

    it('pays the full base when the entire H2 semester was worked, in December', () => {
      const input = baseInput({ extraPayMode: 'INCLUDE_IN_MONTH', periodMonth: 12, altaDate: null, bajaDate: null });
      expect(resolveExtraPayCents(input)).toBe(FAKE_BASE_GROSS);
    });

    it('prorates by semester overlap for a partial semester (worked example: alta 2026-06-10 => 21/181)', () => {
      const input = baseInput({ extraPayMode: 'INCLUDE_IN_MONTH', periodMonth: 6, altaDate: '2026-06-10', bajaDate: null });
      expect(resolveExtraPayCents(input)).toBe(cents(Math.round((FAKE_BASE_GROSS * 21) / 181)));
    });

    it('is zero when employment ended before the December accrual semester began', () => {
      const input = baseInput({ extraPayMode: 'INCLUDE_IN_MONTH', periodMonth: 12, altaDate: null, bajaDate: '2026-06-30' });
      expect(resolveExtraPayCents(input)).toBe(cents(0));
    });

    it('is zero in any month other than June/December', () => {
      const input = baseInput({ extraPayMode: 'INCLUDE_IN_MONTH', periodMonth: 3, altaDate: null, bajaDate: null });
      expect(resolveExtraPayCents(input)).toBe(cents(0));
    });
  });
});

describe('calculatePayrollRun', () => {
  it('full month, no proration: SS is computed (not manually entered), net = gross - ss exactly', () => {
    const result = calculatePayrollRun(baseInput({ periodMonth: 7, altaDate: null, bajaDate: null }));
    // retribución = 90000*14/12 = 105000 -> tramo 5 (877,01-1.061,00) -> base 97000; INDEFINIDO 6,40%.
    const expectedSs = cents(6208);
    expect(result.grossCents).toBe(FAKE_BASE_GROSS);
    expect(result.ssDeductionCents).toBe(expectedSs);
    expect(result.netCents).toBe(cents(FAKE_BASE_GROSS - expectedSs));
    expect(result.prorated).toBe(false);
  });

  it('July partial month (design proof): salary and SS share the same /30 ratio -> gross 366,30, SS 27,35, net 338,95', () => {
    const result = calculatePayrollRun(
      baseInput({ baseGrossCents: FAKE_BASE_GROSS_SS_PROOF, periodMonth: 7, altaDate: '2026-07-23' }),
    );
    expect(result.daysWorked).toBe(9);
    expect(result.daysInMonth).toBe(31);
    expect(result.grossCents).toBe(cents(36630)); // 366,30 EUR: 1221,00 x 9/30
    expect(result.ssDeductionCents).toBe(cents(2735)); // 27,35 EUR: 91,17 x 9/30 (base 1424,50, INDEFINIDO)
    expect(result.netCents).toBe(cents(33895)); // 338,95 EUR
    expect(result.prorated).toBe(true);
  });

  it('full-month SS is identical regardless of the calendar month length (30/30, never 31/30)', () => {
    const july31 = calculatePayrollRun(
      baseInput({ baseGrossCents: FAKE_BASE_GROSS_SS_PROOF, periodMonth: 7, altaDate: null, bajaDate: null }),
    );
    const april30 = calculatePayrollRun(
      baseInput({ baseGrossCents: FAKE_BASE_GROSS_SS_PROOF, periodMonth: 4, altaDate: null, bajaDate: null }),
    );
    expect(july31.ssDeductionCents).toBe(cents(9117)); // 91,17 EUR full-month INDEFINIDO cuota
    expect(april30.ssDeductionCents).toBe(cents(9117));
  });

  it('full-month SS normalizes to /30 even for a 28-day February (not just 30/31-day months)', () => {
    const february28 = calculatePayrollRun(
      baseInput({ baseGrossCents: FAKE_BASE_GROSS_SS_PROOF, periodMonth: 2, periodYear: 2026, altaDate: null, bajaDate: null }),
    );
    expect(february28.daysInMonth).toBe(28);
    expect(february28.prorated).toBe(false);
    expect(february28.ssDeductionCents).toBe(cents(9117)); // identical to the 30/31-day full months
  });

  it('forwards contractType to computeWorkerSs: full-month TEMPORAL run computes 91,88, distinct from the INDEFINIDO 91,17', () => {
    const result = calculatePayrollRun(
      baseInput({
        baseGrossCents: FAKE_BASE_GROSS_SS_PROOF,
        contractType: 'TEMPORAL',
        periodMonth: 7,
        altaDate: null,
        bajaDate: null,
      }),
    );
    expect(result.ssDeductionCents).toBe(cents(9188)); // 91,88 EUR: TEMPORAL full-month cuota, 142450 x 645/10000
    expect(result.ssDeductionCents).not.toBe(cents(9117)); // proves the engine forwards contractType, not hardcodes INDEFINIDO
  });

  it('surfaces the base de cotización it computed with, read off the SAME breakdown as ssDeductionCents (design ADR-2)', () => {
    const input = baseInput({ baseGrossCents: FAKE_BASE_GROSS_SS_PROOF, periodMonth: 7, altaDate: null, bajaDate: null });
    const result = calculatePayrollRun(input);
    const breakdown = computeWorkerSs(RATES_2026, FAKE_BASE_GROSS_SS_PROOF, SS_DIVISOR, 'INDEFINIDO');

    // Equality with the breakdown is the point: a second, independent
    // resolution could introduce a rounding point the cuota never saw.
    expect(result.baseCotizacionCents).toBe(breakdown.baseCotizacionCents);
    expect(result.baseCotizacionCents).toBe(cents(142450)); // 1221,00 x14/12 -> tramo 8, uncapped
  });

  it('surfaces the TGSS golden-vector employer cuota efectiva', () => {
    const result = calculatePayrollRun(
      baseInput({ baseGrossCents: FAKE_BASE_GROSS_SS_PROOF, periodMonth: 7, altaDate: null, bajaDate: null }),
    );

    // The TGSS golden vector: base 1.424,50 INDEFINIDO full month -> 449,43
    // nominal, 317,23 efectivo (engram payroll/tgss-recibo-golden-vector).
    expect(result.employerTotalEfectivoCents).toBe(cents(31723));
    // The surfaced figure equals the pure employer computation on the
    // surfaced base anchor. The golden-vector assertion above is the real
    // guard; this one pins the engine to the domain function's output.
    expect(result.employerTotalEfectivoCents).toBe(
      computeEmployerSsFromBase(RATES_2026, result.baseCotizacionCents, SS_DIVISOR, 'INDEFINIDO').totalEfectivoCents,
    );
  });

  it('prorates the employer anchor by the SS days', () => {
    const partial = calculatePayrollRun(
      baseInput({ baseGrossCents: FAKE_BASE_GROSS_SS_PROOF, periodMonth: 7, altaDate: '2026-07-23' }),
    );

    expect(partial.daysWorked).toBe(9);
    expect(partial.employerTotalEfectivoCents).toBe(cents(9517)); // 95,17 EUR at 9/30
  });

  it('normalizes a non-prorated run to 30/30 for the employer anchor too, never 31/30', () => {
    // July has 31 days; an unclipped run must still anchor the full-month figure.
    const full = calculatePayrollRun(
      baseInput({ baseGrossCents: FAKE_BASE_GROSS_SS_PROOF, periodMonth: 7, altaDate: null, bajaDate: null }),
    );

    expect(full.daysInMonth).toBe(31);
    expect(full.prorated).toBe(false);
    expect(full.employerTotalEfectivoCents).toBe(cents(31723));
  });

  it('anchors the TEMPORAL employer figure when the contract type says so', () => {
    const result = calculatePayrollRun(
      baseInput({
        baseGrossCents: FAKE_BASE_GROSS_SS_PROOF,
        contractType: 'TEMPORAL',
        periodMonth: 7,
        altaDate: null,
        bajaDate: null,
      }),
    );

    expect(result.employerTotalEfectivoCents).toBe(cents(32065)); // 320,65 EUR: the 6,70 % desempleo variant
  });

  it('anchors a zero employer total on a zero-day run', () => {
    const noOverlap = calculatePayrollRun(
      baseInput({ baseGrossCents: FAKE_BASE_GROSS_SS_PROOF, periodMonth: 7, altaDate: '2026-08-01', extraPayMode: 'EXCLUDE' }),
    );

    expect(noOverlap.daysWorked).toBe(0);
    expect(noOverlap.employerTotalEfectivoCents).toBe(cents(0));
  });

  it('echoes the contract type it was given, so the caller can persist it as the run anchor', () => {
    expect(calculatePayrollRun(baseInput({ contractType: 'TEMPORAL' })).contractType).toBe('TEMPORAL');
    expect(calculatePayrollRun(baseInput({ contractType: 'INDEFINIDO' })).contractType).toBe('INDEFINIDO');
  });

  it('anchors the FULL-MONTH base on a partial run -- the anchor is a monthly base, proration stays a separate step', () => {
    const partial = calculatePayrollRun(
      baseInput({ baseGrossCents: FAKE_BASE_GROSS_SS_PROOF, periodMonth: 7, altaDate: '2026-07-23' }),
    );
    expect(partial.prorated).toBe(true);
    expect(partial.daysWorked).toBe(9);
    expect(partial.ssDeductionCents).toBe(cents(2735)); // 27,35 EUR: 9/30 of the full-month cuota
    expect(partial.baseCotizacionCents).toBe(cents(142450)); // unprorated, same as the full month
  });

  it('SS cuota is independent of extraPayMode (base de cotización always includes prorated pagas)', () => {
    const excluded = calculatePayrollRun(
      baseInput({ baseGrossCents: FAKE_BASE_GROSS_SS_PROOF, periodMonth: 7, extraPayMode: 'EXCLUDE' }),
    );
    const prorated = calculatePayrollRun(
      baseInput({ baseGrossCents: FAKE_BASE_GROSS_SS_PROOF, periodMonth: 7, extraPayMode: 'PRORATE' }),
    );
    const includedInMonth = calculatePayrollRun(
      baseInput({ baseGrossCents: FAKE_BASE_GROSS_SS_PROOF, periodMonth: 6, extraPayMode: 'INCLUDE_IN_MONTH' }),
    );
    expect(excluded.ssDeductionCents).toBe(cents(9117));
    expect(prorated.ssDeductionCents).toBe(cents(9117));
    expect(includedInMonth.ssDeductionCents).toBe(cents(9117));
  });

  it('rounding boundary: 90000 x 9/30 rounds exactly once, no further rounding downstream', () => {
    const result = calculatePayrollRun(baseInput({ periodMonth: 7, altaDate: '2026-07-23' }));
    expect(result.grossCents).toBe(cents(27000));
  });

  it('includes the resolved extra in gross for INCLUDE_IN_MONTH in June', () => {
    const result = calculatePayrollRun(
      baseInput({ periodMonth: 6, extraPayMode: 'INCLUDE_IN_MONTH', altaDate: null, bajaDate: null }),
    );
    expect(result.extraCents).toBe(FAKE_BASE_GROSS);
    expect(result.grossCents).toBe(cents(FAKE_BASE_GROSS + FAKE_BASE_GROSS));
  });

  describe('zero-days-worked safety', () => {
    it('alta after period end (PRORATE): gross, ss, extra, net all zero, no throw', () => {
      const result = calculatePayrollRun(
        baseInput({ periodMonth: 7, extraPayMode: 'PRORATE', altaDate: '2026-08-01', bajaDate: null }),
      );
      expect(result.grossCents).toBe(cents(0));
      expect(result.ssDeductionCents).toBe(cents(0));
      expect(result.extraCents).toBe(cents(0));
      expect(result.netCents).toBe(cents(0));
    });

    it('baja before period start (EXCLUDE): gross, ss, extra, net all zero, no throw', () => {
      const result = calculatePayrollRun(
        baseInput({ periodMonth: 7, extraPayMode: 'EXCLUDE', altaDate: null, bajaDate: '2026-06-30' }),
      );
      expect(result.grossCents).toBe(cents(0));
      expect(result.ssDeductionCents).toBe(cents(0));
      expect(result.extraCents).toBe(cents(0));
      expect(result.netCents).toBe(cents(0));
    });

    it('zero run-month days but non-zero semester extra (NEW spec scenario)', () => {
      // Employed Feb 1 - Apr 30 2026, run period is June 2026 (zero overlap with
      // the run month), INCLUDE_IN_MONTH => the June extra still accrues from
      // the Feb-Apr overlap with the H1 semester (Jan 1 - Jun 30).
      const result = calculatePayrollRun(
        baseInput({
          periodMonth: 6,
          extraPayMode: 'INCLUDE_IN_MONTH',
          altaDate: '2026-02-01',
          bajaDate: '2026-04-30',
        }),
      );
      expect(result.grossCents).toBe(result.extraCents);
      expect(result.ssDeductionCents).toBe(cents(0));
      expect(result.extraCents).not.toBe(cents(0));
      expect(result.netCents).toBe(result.extraCents);

      const { startIso, endIso } = semesterBounds(2026, 6);
      const semesterDaysWorked = daysWorkedInInterval('2026-02-01', '2026-04-30', startIso, endIso);
      const semesterTotalDays = daysWorkedInInterval(null, null, startIso, endIso);
      expect(result.extraCents).toBe(proratedAmount(FAKE_BASE_GROSS, semesterDaysWorked, semesterTotalDays));
    });
  });

  describe('period-range derivation (design D1)', () => {
    it('derives the effective period from the explicit range when supplied, ignoring alta/baja for the run-month days', () => {
      const result = calculatePayrollRun(
        baseInput({
          periodMonth: 6,
          altaDate: '2026-01-01',
          bajaDate: null,
          periodStartDate: '2026-06-10',
          periodEndDate: '2026-06-20',
        }),
      );
      expect(result.daysWorked).toBe(11);
      expect(result.daysInMonth).toBe(30);
      expect(result.prorated).toBe(true);
    });

    it('falls back to alta/baja when both range fields are null/absent (no derivation call attempted, no crash)', () => {
      const withRange = calculatePayrollRun(
        baseInput({ periodMonth: 7, altaDate: '2026-07-23', bajaDate: null, periodStartDate: null, periodEndDate: null }),
      );
      const withoutRangeField = calculatePayrollRun(baseInput({ periodMonth: 7, altaDate: '2026-07-23', bajaDate: null }));
      expect(withRange).toEqual(withoutRangeField);
      expect(withRange.daysWorked).toBe(9);
    });

    it('a range with only periodStartDate set is enough to trigger range-based derivation', () => {
      const result = calculatePayrollRun(
        baseInput({ periodMonth: 6, altaDate: null, bajaDate: null, periodStartDate: '2026-06-15', periodEndDate: null }),
      );
      expect(result.daysWorked).toBe(16);
    });

    it('June semester extra pay still derives from alta/baja regardless of the persisted range', () => {
      const result = calculatePayrollRun(
        baseInput({
          periodMonth: 6,
          extraPayMode: 'INCLUDE_IN_MONTH',
          altaDate: null,
          bajaDate: null,
          periodStartDate: '2026-06-10',
          periodEndDate: '2026-06-20',
        }),
      );
      // Extra pay accrues over the full H1 semester (alta/baja both null => fully worked),
      // independent of the narrower run-month range used for salary/SS proration.
      expect(result.extraCents).toBe(FAKE_BASE_GROSS);
    });

    describe('PRORATE pagas extra follow the same run-month days as the salary', () => {
      // FAKE_BASE_GROSS_DIV6 = 1.200,00: a full month accrues 200,00 of pagas extra.

      it('prorates the extra over an explicit range with no alta/baja', () => {
        // 10-20 June = 11 days: salary 1.200,00 x 11/30, extra 1.200,00 x 11/180.
        const result = calculatePayrollRun(
          baseInput({
            baseGrossCents: FAKE_BASE_GROSS_DIV6,
            periodMonth: 6,
            extraPayMode: 'PRORATE',
            altaDate: null,
            bajaDate: null,
            periodStartDate: '2026-06-10',
            periodEndDate: '2026-06-20',
          }),
        );

        expect(result.daysWorked).toBe(11);
        expect(result.extraCents).toBe(cents(7333));
        expect(result.grossCents).toBe(cents(44000 + 7333));
      });

      it('prorates the extra over an explicit range that is NARROWER than alta/baja', () => {
        // Alta 5 June would give 26 days; the range 15-20 June gives 6.
        const result = calculatePayrollRun(
          baseInput({
            baseGrossCents: FAKE_BASE_GROSS_DIV6,
            periodMonth: 6,
            extraPayMode: 'PRORATE',
            altaDate: '2026-06-05',
            bajaDate: null,
            periodStartDate: '2026-06-15',
            periodEndDate: '2026-06-20',
          }),
        );

        expect(result.daysWorked).toBe(6);
        expect(result.extraCents).toBe(cents(4000));
        expect(result.grossCents).toBe(cents(24000 + 4000));
      });

      it('pays the full monthly extra when an explicit full-month range is WIDER than alta/baja', () => {
        // Alta 15 June would give 16 days; the explicit range covers the month.
        const result = calculatePayrollRun(
          baseInput({
            baseGrossCents: FAKE_BASE_GROSS_DIV6,
            periodMonth: 6,
            extraPayMode: 'PRORATE',
            altaDate: '2026-06-15',
            bajaDate: '2026-06-25',
            periodStartDate: '2026-06-01',
            periodEndDate: '2026-06-30',
          }),
        );

        expect(result.prorated).toBe(false);
        expect(result.extraCents).toBe(cents(20000));
        expect(result.grossCents).toBe(cents(120000 + 20000));
      });

      it.each([
        ['range only', { altaDate: null, bajaDate: null, periodStartDate: '2026-07-03', periodEndDate: '2026-07-19' }],
        ['range inside alta/baja', { altaDate: '2026-07-02', bajaDate: '2026-07-28', periodStartDate: '2026-07-10', periodEndDate: null }],
        ['alta/baja only', { altaDate: '2026-07-23', bajaDate: null, periodStartDate: null, periodEndDate: null }],
      ] as const)('salary and extra agree on days worked: %s', (_label, dates) => {
        const result = calculatePayrollRun(
          baseInput({ baseGrossCents: FAKE_BASE_GROSS_DIV6, periodMonth: 7, extraPayMode: 'PRORATE', ...dates }),
        );

        expect(result.prorated).toBe(true);
        expect(result.extraCents).toBe(proratedAmount(FAKE_BASE_GROSS_DIV6, result.daysWorked, 180));
        expect(result.grossCents - result.extraCents).toBe(proratedAmount(FAKE_BASE_GROSS_DIV6, result.daysWorked, 30));
      });
    });
  });

  describe('purity', () => {
    it('does not reference Date.now(): patching it to throw does not break the engine', () => {
      const original = Date.now;
      Date.now = (): number => {
        throw new Error('calculatePayrollRun must never read the system clock');
      };
      try {
        expect(() => calculatePayrollRun(baseInput({ periodMonth: 7, altaDate: '2026-07-23' }))).not.toThrow();
      } finally {
        Date.now = original;
      }
    });

    it('is deterministic: identical inputs produce bit-identical results across calls', () => {
      const input = baseInput({ periodMonth: 6, extraPayMode: 'INCLUDE_IN_MONTH', altaDate: '2026-06-10' });
      const first = calculatePayrollRun(input);
      const second = calculatePayrollRun(input);
      expect(first).toEqual(second);
    });
  });
});
