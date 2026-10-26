/**
 * Pure HTML template for the "Recibo Individual de Salarios" receipt --
 * official Empleados-de-Hogar BOXED-GRID layout (Orden ESS/2098/2014, design
 * ADR-4/D3). A deterministic function of the view-model only -- no I/O, no
 * clock, no randomness. Self-contained: inline `<style>` only, no external
 * assets/fonts/`http` references (required because `expo-print`'s WebView on
 * Android cannot resolve remote/local-file URLs reliably -- see the adapter's
 * doc comment).
 *
 * THIS RECEIPT IS AN "OFFICIAL-FORMAT VISUAL", NOT A LEGAL-COMPLIANCE
 * GUARANTEE: the employer-contribution "determinación de bases" block is
 * rendered from `RatesConfig.employer` at NOMINAL rates, followed by the two
 * benefits the household is modelled on (20 % on contingencias comunes, 80 %
 * on desempleo and FOGASA) and the effective total. The figures are computed
 * by the app for information; they do not replace the Tesorería General de la
 * Seguridad Social liquidation. When the figures cannot be trusted (rates not
 * loaded, or the base de cotización drifted or cannot be checked) the block
 * renders an explanatory note and NO rows or totals -- never a confident
 * number beside a caveat.
 *
 * HEADER LABELS are the annex's own denominations, taken verbatim (art. 1.1 of
 * the Orden of 27-12-1994, BOE-A-1995-912, forbids altering the denomination
 * of an annex concept): `Trabajador`, `NIF`, `Núm. Afil. Seguridad Social`,
 * `Grupo profesional`, `Grupo de cotización` for the worker box. They are
 * static literals and are never escaped; only the interpolated values are.
 * The worker's `grupoProfesional` and `grupoCotizacion` are two different
 * annex concepts and must never be wired to each other (see
 * `GRUPO_PROFESIONAL` in `ReceiptViewModel.ts`).
 *
 * The employer box prints `Empresa`, `Domicilio`, `NIF`, `CCC`, in annex
 * order. `Empresa` stays bare even though the employer is a household: the
 * `Datos del empleador` heading above supplies that context, and adding
 * information around a denomination is permitted while renaming it is not.
 * The annex's own `CIF` is deliberately printed as `NIF`: the CIF was
 * abolished by RD 1065/2007 (BOE-A-2007-15984, disposición derogatoria única
 * 1.a), and art. 18.1 gives natural and legal persons a single NIF. `NIF` is a
 * label in BOTH header boxes.
 *
 * ============================================================================
 * ANDROID MARGIN QUIRK -- DO NOT MODIFY WITHOUT DEVICE-VERIFYING AGAIN
 * ============================================================================
 * `FilePrintOptions.margins` is iOS-only, so the page box is controlled
 * ENTIRELY via CSS: `@page { margin: 12mm; }` + a ZERO-margin `body` plus an
 * inner `.content` wrapper that supplies the visual padding instead. This is
 * the only strategy that has been device-verified as deterministic across
 * the Android WebView print engine (`expo-print` -> Android `PrintManager`).
 * If you touch the `@page`/`body{margin:0}`/`.content` rules, you MUST
 * re-verify on a physical Android device (or equivalent emulator) that the
 * printed PDF is not clipped and the boxed-grid borders render without being
 * cut off at the page edge -- this is NOT unit-testable (spec Scenario 14,
 * device-QA only).
 * ============================================================================
 */

import { escapeHtml } from './escapeHtml';
import type {
  ReceiptDeduccionDesglose,
  ReceiptEmpleadorBeneficioRow,
  ReceiptEmpleadorCotizacion,
  ReceiptEmpleadorCuotaRow,
  ReceiptLineItem,
  ReceiptViewModel,
} from './ReceiptViewModel';

function renderLineItems(items: readonly ReceiptLineItem[]): string {
  return items.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td class="amount">${escapeHtml(item.amount)}</td></tr>`).join('');
}

function renderDesgloseRows(rows: readonly ReceiptDeduccionDesglose[]): string {
  return rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.concepto)}</td><td class="amount">${escapeHtml(row.baseMensual)}</td><td class="amount">${escapeHtml(row.basePeriodo)}</td><td class="amount">${escapeHtml(row.tipo)}</td><td class="amount">${escapeHtml(row.cuota)}</td></tr>`,
    )
    .join('');
}

/**
 * Deducciones section body: itemized per-contingency breakdown when present
 * (spec "Worker deduction breakdown by contingency"), falling back to the
 * single lump SS line when `deduccionesDesglose` is empty (`ratesConfig`
 * unavailable at build time -- no breakdown attempted, no crash).
 */
function renderDeducciones(viewModel: ReceiptViewModel): string {
  if (viewModel.deduccionesDesglose.length > 0) {
    return `<table>
        <tr><th>Concepto</th><th class="amount">Base mensual</th><th class="amount">Base del periodo</th><th class="amount">Tipo</th><th class="amount">Cuota</th></tr>
        ${renderDesgloseRows(viewModel.deduccionesDesglose)}
        <tr class="total-row"><td colspan="4">Total a deducir</td><td class="amount">${escapeHtml(viewModel.totalDeducciones)}</td></tr>
      </table>`;
  }

  return `<table>
        ${renderLineItems(viewModel.deducciones)}
        <tr class="total-row"><td>Total a deducir</td><td class="amount">${escapeHtml(viewModel.totalDeducciones)}</td></tr>
      </table>`;
}

function renderEmpleadorRows(rows: readonly ReceiptEmpleadorCuotaRow[]): string {
  return rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.concepto)}</td><td class="amount">${escapeHtml(row.basePeriodo)}</td><td class="amount">${escapeHtml(row.tipo)}</td><td class="amount">${escapeHtml(row.cuota)}</td></tr>`,
    )
    .join('');
}

/**
 * Benefit rows reuse the four-column grid but their second cell is a CUOTA
 * (`cuotaAfectada`), not a base de cotización -- the sub-header row emitted by
 * `renderEmpleadorCotizacion` relabels that column so the table never prints a
 * cuota under a "Base del periodo" header.
 */
function renderBeneficioRows(rows: readonly ReceiptEmpleadorBeneficioRow[]): string {
  return rows
    .map(
      (row) =>
        `<tr class="beneficio"><td>${escapeHtml(row.concepto)}</td><td class="amount">${escapeHtml(row.cuotaAfectada)}</td><td class="amount">${escapeHtml(row.tipo)}</td><td class="amount">${escapeHtml(row.importe)}</td></tr>`,
    )
    .join('');
}

/**
 * Employer "determinación de bases y cuotas" section. Wrapped in ONE div that
 * carries `page-break-inside: avoid` (the rule is unreliable on a `<table>` in
 * the Android WebView), and the heading lives INSIDE that div so it can never
 * be stranded on the previous page. Components, benefits and both totals are
 * rows of a SINGLE table: three tables would give the print engine three
 * places to break.
 *
 * The `unavailable` branch renders its note and no rows or totals, for every
 * reason: retiring the old disclaimer must not turn an honest admission into a
 * silent omission.
 */
function renderEmpleadorCotizacion(cotizacion: ReceiptEmpleadorCotizacion): string {
  const heading = '<h2>Determinación de bases y cuotas a cargo de la parte empleadora</h2>';

  if (cotizacion.kind === 'unavailable') {
    return `<div class="empleador-cotizacion">
        ${heading}
        <p class="nota">${escapeHtml(cotizacion.nota)}</p>
      </div>`;
  }

  return `<div class="empleador-cotizacion">
        ${heading}
        <table>
          <tr><th>Concepto</th><th class="amount">Base del periodo</th><th class="amount">Tipo</th><th class="amount">Cuota</th></tr>
          ${renderEmpleadorRows(cotizacion.filas)}
          <tr class="total-row"><td colspan="3">Cuota de la parte empleadora</td><td class="amount">${escapeHtml(cotizacion.totalNominal)}</td></tr>
          <tr><th>Beneficios en la cotización</th><th class="amount">Cuota afectada</th><th class="amount">Tipo</th><th class="amount">Importe</th></tr>
          ${renderBeneficioRows(cotizacion.beneficios)}
          <tr class="total-row"><td colspan="3">Total a ingresar por la parte empleadora</td><td class="amount">${escapeHtml(cotizacion.totalEfectivo)}</td></tr>
        </table>
      </div>`;
}

/**
 * Legal-basis footnote, rendered only when figures are: it describes the
 * figures, so beside a no-figures note it would cite norms for numbers that are
 * not on the page. Norms are cited by BOE id only -- the document is
 * self-contained and must carry no URL.
 */
const NOTA_BASE_LEGAL =
  'Tipos de cotización: Orden PJC/297/2026 (BOE-A-2026-7296), arts. 15, 16 y 35; tarifa de primas para AT y EP: disposición adicional 61ª del TRLGSS, redactada por el Real Decreto-ley 3/2026 (BOE-A-2026-2548). Beneficios en la cotización: Real Decreto-ley 16/2022 (BOE-A-2022-14680), disposición adicional 1ª, apartado 1. Importes calculados por la aplicación a efectos informativos; no sustituyen a la liquidación de la Tesorería General de la Seguridad Social.';

export function buildReceiptHtml(viewModel: ReceiptViewModel): string {
  const {
    empleador,
    trabajador,
    periodo,
    devengos,
    totalDevengos,
    liquidoTotal,
    empleadorCotizacion,
    lugarYFecha,
    firmaLabel,
    empleadorFirmaImagenBase64,
    empleadorFirmaLabel,
  } = viewModel;

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Recibo Individual de Salarios</title>
    <style>
      @page { margin: 12mm; }
      body {
        margin: 0;
        font-family: Helvetica, Arial, sans-serif;
        color: #111827;
        -webkit-print-color-adjust: exact;
      }
      .content { padding: 0; }
      h1 { font-size: 16px; text-align: center; margin: 0 0 12px; }
      h2 { font-size: 12px; text-transform: uppercase; margin: 16px 0 4px; border-bottom: 1px solid #111827; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { padding: 3px 4px; border: 1px solid #111827; }
      th { text-align: left; font-weight: bold; background-color: #f3f4f6; }
      .amount { text-align: right; }
      .total-row td { font-weight: bold; }
      .header-grid { border: none; }
      .header-grid td { vertical-align: top; border: 1px solid #111827; width: 50%; padding: 4px 8px; }
      .header-grid table { border: none; }
      .header-grid table td { border: none; padding: 2px 0; }
      .empleador-cotizacion { page-break-inside: avoid; }
      .empleador-cotizacion td:first-child { width: 46%; }
      .empleador-cotizacion .amount { white-space: nowrap; }
      .empleador-cotizacion .nota { margin: 4px 0 0; font-size: 11px; }
      .firma { margin-top: 40px; page-break-inside: avoid; }
      .firma-grid { border: none; page-break-inside: avoid; }
      .firma-grid td { width: 50%; border: none; vertical-align: bottom; padding: 0 8px 0 0; }
      .firma-line { margin-top: 24px; border-top: 1px solid #111827; width: 60%; }
      .firma-grid td .firma-line { width: 90%; }
      .firma-image { display: block; max-width: 90%; max-height: 64px; margin-top: 4px; }
      .firma-label { margin: 4px 0 0; font-size: 11px; }
      .footnote { margin-top: 24px; font-size: 9px; color: #4b5563; }
    </style>
  </head>
  <body>
    <div class="content">
      <h1>Recibo Individual de Salarios</h1>

      <table class="header-grid">
        <tr>
          <td>
            <h2>Datos del empleador</h2>
            <table>
              <tr><td>Empresa</td><td class="amount">${escapeHtml(empleador.nombre)}</td></tr>
              <tr><td>Domicilio</td><td class="amount">${escapeHtml(empleador.domicilio)}</td></tr>
              <tr><td>NIF</td><td class="amount">${escapeHtml(empleador.nif)}</td></tr>
              <tr><td>CCC</td><td class="amount">${escapeHtml(empleador.ccc)}</td></tr>
            </table>
          </td>
          <td>
            <h2>Datos del trabajador</h2>
            <table>
              <tr><td>Trabajador</td><td class="amount">${escapeHtml(trabajador.nombre)}</td></tr>
              <tr><td>NIF</td><td class="amount">${escapeHtml(trabajador.nif)}</td></tr>
              <tr><td>Núm. Afil. Seguridad Social</td><td class="amount">${escapeHtml(trabajador.naf)}</td></tr>
              <tr><td>Grupo profesional</td><td class="amount">${escapeHtml(trabajador.grupoProfesional)}</td></tr>
              <tr><td>Grupo de cotización</td><td class="amount">${escapeHtml(trabajador.grupoCotizacion)}</td></tr>
            </table>
          </td>
        </tr>
      </table>

      <h2>Período de liquidación</h2>
      <table>
        <tr><td>Período</td><td class="amount">${escapeHtml(periodo.descripcion)}</td></tr>
        ${periodo.rango !== null ? `<tr><td>Rango de días</td><td class="amount">${escapeHtml(periodo.rango)}</td></tr>` : ''}
        <tr><td>Días trabajados</td><td class="amount">${periodo.diasTrabajados} / ${periodo.diasNaturales} días</td></tr>
        ${periodo.prorrateado ? '<tr><td colspan="2">Mes prorrateado.</td></tr>' : ''}
      </table>

      <h2>Devengos</h2>
      <table>
        ${renderLineItems(devengos)}
        <tr class="total-row"><td>Total devengado</td><td class="amount">${escapeHtml(totalDevengos)}</td></tr>
      </table>

      <h2>Deducciones</h2>
      ${renderDeducciones(viewModel)}

      <h2>Líquido total a percibir</h2>
      <table>
        <tr class="total-row"><td>Líquido total</td><td class="amount">${escapeHtml(liquidoTotal)}</td></tr>
      </table>

      ${renderEmpleadorCotizacion(empleadorCotizacion)}

      <div class="firma">
        <p>${escapeHtml(lugarYFecha)}</p>
        <table class="firma-grid">
          <tr>
            <td>
              ${empleadorFirmaImagenBase64 === null
                ? '<div class="firma-line"></div>'
                : `<img class="firma-image" alt="" src="data:image/png;base64,${escapeHtml(empleadorFirmaImagenBase64)}" />`}
              <p class="firma-label">${escapeHtml(empleadorFirmaLabel)}</p>
            </td>
            <td>
              <div class="firma-line"></div>
              <p class="firma-label">${escapeHtml(firmaLabel)}</p>
            </td>
          </tr>
        </table>
      </div>

      ${empleadorCotizacion.kind === 'figures' ? `<p class="footnote">${NOTA_BASE_LEGAL}</p>` : ''}
    </div>
  </body>
</html>`;
}
