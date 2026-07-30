import { addCents, cents, fromEuros, multiplyByRatio, subtractCents, toEuros } from './money';

describe('cents', () => {
  it('accepts an integer number of cents', () => {
    expect(cents(0)).toBe(0);
    expect(cents(150000)).toBe(150000);
    expect(cents(-500)).toBe(-500);
  });

  it('rejects non-integer values', () => {
    expect(() => cents(10.5)).toThrow(RangeError);
  });
});

describe('addCents', () => {
  it('adds two amounts', () => {
    expect(addCents(cents(1000), cents(500))).toBe(1500);
  });

  it('handles zero', () => {
    expect(addCents(cents(0), cents(0))).toBe(0);
  });

  it('handles negative amounts (corrections/refunds)', () => {
    expect(addCents(cents(1000), cents(-1500))).toBe(-500);
  });
});

describe('subtractCents', () => {
  it('subtracts the SS deduction from the gross salary', () => {
    // CLAUDE.md §5: Net salary = Gross salary - Employee SS deduction.
    // Fake placeholder figures only, per CLAUDE.md §5.
    expect(subtractCents(cents(150000), cents(30000))).toBe(120000);
  });

  it('can produce a negative result (caller decides if that is valid)', () => {
    expect(subtractCents(cents(100), cents(300))).toBe(-200);
  });
});

describe('multiplyByRatio (pro-rata on exact days worked)', () => {
  it('returns the full amount when the ratio is 1', () => {
    expect(multiplyByRatio(cents(150000), 30, 30)).toBe(150000);
  });

  it('returns zero when zero days were worked', () => {
    expect(multiplyByRatio(cents(150000), 0, 30)).toBe(0);
  });

  it('prorates an incomplete month on exact days worked', () => {
    // 15 of 30 days -> exactly half, no rounding needed.
    expect(multiplyByRatio(cents(150000), 15, 30)).toBe(75000);
  });

  it('rounds half up at the cent boundary', () => {
    // 1 cent * 1/2 = 0.5 -> rounds up to 1.
    expect(multiplyByRatio(cents(1), 1, 2)).toBe(1);
    // 3 cents * 1/2 = 1.5 -> rounds up to 2.
    expect(multiplyByRatio(cents(3), 1, 2)).toBe(2);
  });

  it('rounds half up even for negative amounts (rounds toward positive infinity)', () => {
    expect(multiplyByRatio(cents(-1), 1, 2)).toBe(0);
  });

  it('throws when the denominator is zero', () => {
    expect(() => multiplyByRatio(cents(1000), 1, 0)).toThrow(RangeError);
  });
});

describe('fromEuros / toEuros', () => {
  it('converts euros to cents', () => {
    expect(fromEuros(1500)).toBe(150000);
    expect(fromEuros(0)).toBe(0);
  });

  it('rounds safely around floating point imprecision (e.g. 1234.56)', () => {
    // 1234.56 * 100 is 123455.99999999999 in raw floating point math.
    expect(fromEuros(1234.56)).toBe(123456);
  });

  it('converts cents back to euros', () => {
    expect(toEuros(cents(150000))).toBe(1500);
    expect(toEuros(cents(123456))).toBeCloseTo(1234.56);
  });

  it('round-trips without drift', () => {
    const original = 999.99;
    expect(toEuros(fromEuros(original))).toBeCloseTo(original);
  });
});
