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

/** One itemized worker SS deduction line, by contingency (contingencias comunes / desempleo / MEI). Formatted display strings only -- `Cents` never leaks past `buildReceiptViewModel`. */
export interface ReceiptDeduccionDesglose {
  readonly concepto: string;
  /**
   * Full, unprorated base de cotización mensual, formatted via
   * `formatEuros` -- informational only, the same value on every row
   * (shared base). On a full month this equals `basePeriodo`.
   */
  readonly baseMensual: string;
  /**
   * Operative base for this row: `baseMensual` prorated by the same
   * `daysWorked/30` ratio the engine used for the SS cuota, formatted via
   * `formatEuros`. `basePeriodo x tipo` reconciles to `cuota` (within the
   * pre-existing 1-cent residual-on-largest-line tolerance).
   */
  readonly basePeriodo: string;
  /** Contribution rate as a percentage, e.g. `"4,70 %"`. */
  readonly tipo: string;
  /** Already formatted via `formatEuros`. */
  readonly cuota: string;
}

export interface ReceiptViewModel {
  readonly empleador: {
    readonly nombre: string;
    /** `"—"` when the employer has no NIF on file. */
    readonly nif: string;
    /** `"—"` when the employer has no address on file. */
    readonly domicilio: string;
    /**
     * Código Cuenta de Cotización. `"—"` when the employer has no CCC on
     * file (mirrors the `nif`/`domicilio` placeholder pattern). Rendered as a
     * plain value -- NO checksum badge or "verified" claim (control-digit
     * checksum stays re-deferred, see `features/employer/domain/validateCcc.ts`).
     */
    readonly ccc: string;
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
    /**
     * Literal persisted day-range, e.g. `"del día 1 al 30"`. `null` when
     * either `periodStartDate`/`periodEndDate` is absent on the run (legacy
     * runs pre-dating this field) -- the receipt then shows only
     * `diasTrabajados`/`diasNaturales`, exactly as it did before this slice.
     */
    readonly rango: string | null;
  };
  readonly devengos: readonly ReceiptLineItem[];
  readonly totalDevengos: string;
  /** Kept for the `ratesConfig === null` fallback (today's single-lump-line behavior); superseded by `deduccionesDesglose` when non-empty. */
  readonly deducciones: readonly ReceiptLineItem[];
  /**
   * Per-contingency breakdown of the worker's SS cuota (contingencias
   * comunes / desempleo / MEI), derived from `RatesConfig.worker`. Empty when
   * `ratesConfig` was not supplied to the builder -- callers fall back to
   * rendering `deducciones` instead (no breakdown attempted, no crash).
   */
  readonly deduccionesDesglose: readonly ReceiptDeduccionDesglose[];
  readonly totalDeducciones: string;
  readonly liquidoTotal: string;
  readonly lugarYFecha: string;
  readonly firmaLabel: string;
}
