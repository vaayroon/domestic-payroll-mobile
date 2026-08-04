/**
 * Pure view-model for the "Recibo Individual de Salarios" receipt (design
 * ADR-3). Cents in, formatted Spanish strings out -- no `Cents`/domain types
 * leak past `buildReceiptViewModel`; `buildReceiptHtml` only ever sees these
 * already-formatted strings.
 */

export interface ReceiptLineItem {
  readonly label: string;
  /** Already formatted via `formatEuros` (e.g. "900,00 €"). */
  readonly amount: string;
}

export interface ReceiptViewModel {
  readonly empleador: {
    readonly nombre: string;
    /** `"—"` when the employer has no NIF on file. */
    readonly nif: string;
    /** `"—"` when the employer has no address on file. */
    readonly domicilio: string;
  };
  readonly trabajador: {
    readonly nombre: string;
    /** `"—"` when the employee has no NIF on file. */
    readonly nif: string;
    /** `"—"` when the employee has no NAF on file. */
    readonly naf: string;
    readonly grupoCotizacion: string;
  };
  readonly periodo: {
    /** e.g. "junio de 2026". */
    readonly descripcion: string;
    readonly diasTrabajados: number;
    readonly diasNaturales: number;
    readonly prorrateado: boolean;
  };
  readonly devengos: readonly ReceiptLineItem[];
  readonly totalDevengos: string;
  readonly deducciones: readonly ReceiptLineItem[];
  readonly totalDeducciones: string;
  readonly liquidoTotal: string;
  readonly lugarYFecha: string;
  readonly firmaLabel: string;
}
