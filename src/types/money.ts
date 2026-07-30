/**
 * Money domain type — integer cents, never a float.
 *
 * CLAUDE.md §4: "Money is never a float in logic. Represent amounts in integer
 * cents ... round only at the presentation/PDF boundary." These helpers are
 * pure functions: no I/O, no system dates, no formatting. `fromEuros`/`toEuros`
 * are the only conversion points between a euro-denominated input/output and
 * the internal integer-cents representation; rounding happens ONLY inside the
 * `roundHalfUp` helper below (used by `multiplyByRatio` and `fromEuros`) and is
 * never allowed to leak into repeated arithmetic, so proration never
 * accumulates drift across a payroll run.
 *
 * Presentation formatting (e.g. an `Intl.NumberFormat('es-ES', ...)` currency
 * string) is intentionally NOT here — it belongs at the UI/PDF boundary in a
 * later slice, so this module stays formatting-free.
 */

/** A whole number of cents, branded so it can't be confused with a plain number. */
export type Cents = number & { readonly __brand: 'Cents' };

/**
 * Constructs a `Cents` value, asserting the input is a safe integer.
 * This is the only entry point into the branded type other than `fromEuros`.
 */
export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new RangeError(`Cents must be an integer, received ${value}`);
  }
  return value as Cents;
}

/** Adds two amounts. Exact — no rounding involved (both operands are integers). */
export function addCents(a: Cents, b: Cents): Cents {
  return cents(a + b);
}

/** Subtracts `b` from `a` (e.g. gross salary minus the SS deduction, per CLAUDE.md §5). */
export function subtractCents(a: Cents, b: Cents): Cents {
  return cents(a - b);
}

/**
 * Multiplies an amount by an exact `numerator/denominator` ratio, e.g. the
 * days-worked / days-in-month ratio used for pro-rata (CLAUDE.md §5).
 *
 * The ratio is expressed as two integers (never a pre-divided float rate) so
 * the only rounding in the whole operation happens once, at the very end, via
 * `roundHalfUp`.
 */
export function multiplyByRatio(amount: Cents, numerator: number, denominator: number): Cents {
  if (denominator === 0) {
    throw new RangeError('multiplyByRatio: denominator must not be zero');
  }
  return cents(roundHalfUp((amount * numerator) / denominator));
}

/**
 * Converts a euro amount (e.g. user input, a config value) into `Cents`.
 * Rounds via `roundHalfUp` to absorb floating point imprecision
 * (e.g. `1234.56 * 100 === 123455.99999999999` in raw JS floating point math).
 */
export function fromEuros(euros: number): Cents {
  return cents(roundHalfUp(euros * 100));
}

/**
 * Converts `Cents` back to a plain euro number. This is arithmetic only —
 * formatting (currency symbol, locale grouping) happens at the presentation
 * boundary, not here.
 */
export function toEuros(amount: Cents): number {
  return amount / 100;
}

/**
 * Rounds half up, rounding ties toward positive infinity (e.g. 0.5 -> 1,
 * -0.5 -> 0). This is the ONLY place rounding happens in domain money math;
 * every other helper in this module is exact integer arithmetic.
 */
function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}
