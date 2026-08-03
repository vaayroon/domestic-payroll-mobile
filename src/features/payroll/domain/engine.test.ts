import { cents } from '@/types/money';

import {
  calculatePayrollRun,
  daysInMonth,
  daysWorkedInInterval,
  proratedAmount,
  resolveEffectivePeriod,
  resolveExtraPayCents,
  semesterBounds,
  type PayrollInput,
} from './engine';

// All amounts below are obviously-fake placeholders (CLAUDE.md §5) -- never
// real salary figures.
const FAKE_BASE_GROSS = cents(90000); // 900,00 EUR
const FAKE_FULL_SS = cents(10000); // 100,00 EUR
const FAKE_BASE_GROSS_DIV6 = cents(120000); // 1200,00 EUR -- exactly divisible by 6

function baseInput(overrides: Partial<PayrollInput> = {}): PayrollInput {
  return {
    baseGrossCents: FAKE_BASE_GROSS,
    fullMonthSsCents: FAKE_FULL_SS,
    periodYear: 2026,
    periodMonth: 7,
    altaDate: null,
    bajaDate: null,
    extraPayMode: 'EXCLUDE',
    ...overrides,
  };
}

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
      expect(resolveExtraPayCents(input)).toBe(cents(Math.round((FAKE_BASE_GROSS * 9) / (6 * 31))));
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
  it('full month, no proration: gross/ss pass through, net = gross - ss exactly', () => {
    const result = calculatePayrollRun(baseInput({ periodMonth: 7, altaDate: null, bajaDate: null }));
    expect(result.grossCents).toBe(FAKE_BASE_GROSS);
    expect(result.ssDeductionCents).toBe(FAKE_FULL_SS);
    expect(result.netCents).toBe(cents(FAKE_BASE_GROSS - FAKE_FULL_SS));
    expect(result.prorated).toBe(false);
  });

  it('mid-month alta prorates gross and SS independently by the identical ratio', () => {
    const result = calculatePayrollRun(baseInput({ periodMonth: 7, altaDate: '2026-07-23' }));
    const expectedGross = proratedAmount(FAKE_BASE_GROSS, 9, 31);
    const expectedSs = proratedAmount(FAKE_FULL_SS, 9, 31);
    expect(result.grossCents).toBe(expectedGross);
    expect(result.ssDeductionCents).toBe(expectedSs);
    expect(result.netCents).toBe(cents(expectedGross - expectedSs));
    expect(result.prorated).toBe(true);
    expect(result.daysWorked).toBe(9);
    expect(result.daysInMonth).toBe(31);
  });

  it('rounding boundary: 90000 x 9/31 rounds exactly once, no further rounding downstream', () => {
    const result = calculatePayrollRun(baseInput({ periodMonth: 7, altaDate: '2026-07-23', fullMonthSsCents: cents(0) }));
    expect(result.grossCents).toBe(cents(26129));
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
