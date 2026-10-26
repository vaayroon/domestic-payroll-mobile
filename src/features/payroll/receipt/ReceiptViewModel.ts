/**
 * Pure view-model for the "Recibo Individual de Salarios" receipt (design
 * ADR-3). Cents in, formatted Spanish strings out -- no `Cents`/domain types
 * leak past `buildReceiptViewModel`; `buildReceiptHtml` only ever sees these
 * already-formatted strings.
 */

/**
 * The worker's professional group, a fixed description of this regime printed
 * under the annex's `Grupo profesional` denomination.
 *
 * `as const` is load-bearing: `ReceiptViewModel['trabajador']['grupoProfesional']`
 * is typed as this literal, NOT `string`, so the employee's stored (free text)
 * `grupoCotizacion` cannot be assigned into the professional-group slot. Both
 * slots hold a string, so without the literal type a mis-wire would compile.
 * Do not widen it to `string` for convenience; that silently removes the guard.
 */
export const GRUPO_PROFESIONAL = 'Empleado/a de Hogar' as const;

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

/** One nominal employer contribution row: base de cotización x nominal tipo. */
export interface ReceiptEmpleadorCuotaRow {
  readonly concepto: string;
  /** Base de cotización for the period (prorated `daysWorked/30`), formatted via `formatEuros`. */
  readonly basePeriodo: string;
  /** Nominal contribution rate as a percentage, e.g. `"23,60 %"`. */
  readonly tipo: string;
  /** Already formatted via `formatEuros`. */
  readonly cuota: string;
}

/**
 * One employer benefit row. Its operand is a CUOTA already computed above,
 * never a base de cotización -- hence `cuotaAfectada`, not `basePeriodo`, so a
 * benefit row cannot be assigned into the nominal array by mistake.
 */
export interface ReceiptEmpleadorBeneficioRow {
  readonly concepto: string;
  /** Sum of the nominal cuotas this benefit applies to, formatted. A cuota, NOT a base. */
  readonly cuotaAfectada: string;
  /** Benefit percentage, e.g. `"20 %"`. */
  readonly tipo: string;
  /** Already negative and formatted, e.g. `"-67,24 €"`. */
  readonly importe: string;
}

/** The employer block with confident figures: rates present and the base verified. */
export interface ReceiptEmpleadorCotizacionCifras {
  readonly kind: 'figures';
  /** The five nominal rows, in display order. */
  readonly filas: readonly ReceiptEmpleadorCuotaRow[];
  /** The two benefit rows, always after the nominal rows. */
  readonly beneficios: readonly ReceiptEmpleadorBeneficioRow[];
  /** Exact sum of the nominal rows, formatted. */
  readonly totalNominal: string;
  /** Nominal total minus both benefits, formatted. */
  readonly totalEfectivo: string;
}

/**
 * Why the employer block carries no figures:
 * - `rates_unavailable`: the period year has no `RatesConfig` entry.
 * - `base_drifted`: the receipt's recompute no longer matches what the run
 *   persisted, so any figure would be wrong. The recompute uses the run's own
 *   base and contract type when it has them, the current employee's otherwise.
 *   Either the worker cuota differs, or, for a run carrying the employer
 *   anchor, the employer cuota efectiva does.
 * - `base_not_verifiable`: the run lacks the inputs for that comparison (legacy).
 */
export type ReceiptEmpleadorCotizacionNoDisponibleReason = 'rates_unavailable' | 'base_drifted' | 'base_not_verifiable';

/** The employer block with NO figures at all, only an explanatory note. */
export interface ReceiptEmpleadorCotizacionNoDisponible {
  readonly kind: 'unavailable';
  readonly reason: ReceiptEmpleadorCotizacionNoDisponibleReason;
  /** Spanish note rendered instead of rows and totals. */
  readonly nota: string;
}

/**
 * Employer "determinación de bases y cuotas" block. A discriminated union so
 * that figures and a "no reliable figures here" note can never coexist: a type
 * able to hold both at once would invite rendering a confident number beside a
 * note saying it cannot be trusted.
 */
export type ReceiptEmpleadorCotizacion = ReceiptEmpleadorCotizacionCifras | ReceiptEmpleadorCotizacionNoDisponible;

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
    /** The annex's `Grupo profesional`: always `GRUPO_PROFESIONAL`, never the employee's own data. */
    readonly grupoProfesional: typeof GRUPO_PROFESIONAL;
    /**
     * The annex's `Grupo de cotización`: the value stored on the employee, or
     * `"—"` when none is on file. Never a default group.
     */
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
  /** Employer contribution block, or the note explaining why it carries no figures. */
  readonly empleadorCotizacion: ReceiptEmpleadorCotizacion;
  readonly lugarYFecha: string;
  readonly firmaLabel: string;
  /** Bare base64 PNG (NO `data:` prefix) of the employer's saved signature; `null` renders a blank hand-signable line instead. */
  readonly empleadorFirmaImagenBase64: string | null;
  /** Spanish label under the employer signature column. */
  readonly empleadorFirmaLabel: string;
}
