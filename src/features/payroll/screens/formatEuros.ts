/**
 * Presentation-only EUR formatting helper (design ADR-4). Deliberately NOT
 * part of `@/types/money` -- `money.ts` documents itself as formatting-free
 * (CLAUDE.md §4: rounding happens only inside domain math, currency display
 * belongs at the UI/PDF boundary). Mirrors the inline `EUR_FORMATTER` already
 * used by `EmployeeListItem`, promoted to a reusable helper for the payroll
 * screens that need the same Spanish currency format in several places
 * (preview, future receipt).
 */

import { toEuros, type Cents } from '@/types/money';

const EUR_FORMATTER = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export function formatEuros(amount: Cents): string {
  return EUR_FORMATTER.format(toEuros(amount));
}
