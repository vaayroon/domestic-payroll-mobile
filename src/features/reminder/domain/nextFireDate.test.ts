import { computeNextFireDate } from './nextFireDate';

// All fixtures use the LOCAL-time `Date` constructor and assertions read
// LOCAL getters only (design D2/D9) -- no fake timers, no `Date.now` mock.
// This round-trips identically under any machine timezone: construction and
// readback both resolve against the SAME zone, so the only thing left
// untested here is the absolute epoch, which is exactly the DST-correct part
// the device itself is responsible for resolving.

describe('computeNextFireDate', () => {
  it('NFD-1: same-month, target day still ahead -> this month at the target time', () => {
    const reference = new Date(2026, 3, 3, 8, 0); // April 3, 08:00
    const result = computeNextFireDate(reference, 5, 9, 0);

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3);
    expect(result.getDate()).toBe(5);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });

  it('NFD-2: 30-day month clamp -- day 31 in April clamps to day 30', () => {
    const reference = new Date(2026, 3, 1, 0, 0); // April 1
    const result = computeNextFireDate(reference, 31, 9, 0);

    expect(result.getMonth()).toBe(3);
    expect(result.getDate()).toBe(30);
  });

  it('NFD-3: February non-leap clamp -- day 31 in Feb 2026 clamps to Feb 28', () => {
    const reference = new Date(2026, 1, 1, 0, 0); // Feb 1, 2026 (non-leap)
    const result = computeNextFireDate(reference, 31, 9, 0);

    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });

  it('NFD-4: leap-year February keeps day 29', () => {
    const reference = new Date(2028, 1, 1, 0, 0); // Feb 1, 2028 (leap)
    const result = computeNextFireDate(reference, 29, 9, 0);

    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(29);
  });

  it('NFD-5: reference still ahead of the target time on the target day -- fires today', () => {
    const reference = new Date(2026, 3, 5, 7, 0); // April 5, 07:00
    const result = computeNextFireDate(reference, 5, 9, 0);

    expect(result.getMonth()).toBe(3);
    expect(result.getDate()).toBe(5);
    expect(result.getHours()).toBe(9);
  });

  it('NFD-6: reference past the target time on the target day -- rolls to next month', () => {
    const reference = new Date(2026, 3, 5, 10, 0); // April 5, 10:00
    const result = computeNextFireDate(reference, 5, 9, 0);

    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(5);
    expect(result.getHours()).toBe(9);
  });

  it('NFD-7: exact-equal boundary -- rolls to next month, never re-fires immediately', () => {
    const reference = new Date(2026, 3, 5, 9, 0); // exactly April 5, 09:00
    const result = computeNextFireDate(reference, 5, 9, 0);

    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(5);
    expect(result.getHours()).toBe(9);
  });

  it('NFD-8: December rollover -- passed-today in December rolls to January of next year', () => {
    const reference = new Date(2026, 11, 20, 10, 0); // Dec 20, 2026, 10:00
    const result = computeNextFireDate(reference, 5, 9, 0);

    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(5);
    expect(result.getHours()).toBe(9);
  });

  it('NFD-9: DST-boundary month -- local wall-clock day/hour/minute survive unchanged', () => {
    // March 2026 contains Spain's spring-forward transition; the assertions
    // below only touch LOCAL fields, so they hold regardless of the machine
    // timezone actually running the test.
    const reference = new Date(2026, 2, 1, 8, 0); // March 1, 08:00
    const result = computeNextFireDate(reference, 31, 9, 0);

    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(31);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });
});
