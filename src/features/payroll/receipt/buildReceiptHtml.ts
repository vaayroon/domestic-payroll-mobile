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
 * GUARANTEE: the employer-contribution "determinación de bases" block
 * (empresa-side SS contribution breakdown) is explicitly OUT OF SCOPE for
 * this slice -- see the footnote rendered at the bottom of the document.
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

import type { ReceiptDeduccionDesglose, ReceiptLineItem, ReceiptViewModel } from './ReceiptViewModel';

function renderLineItems(items: readonly ReceiptLineItem[]): string {
  return items.map((item) => `<tr><td>${item.label}</td><td class="amount">${item.amount}</td></tr>`).join('');
}

function renderDesgloseRows(rows: readonly ReceiptDeduccionDesglose[]): string {
  return rows
    .map(
      (row) =>
        `<tr><td>${row.concepto}</td><td class="amount">${row.baseMensual}</td><td class="amount">${row.basePeriodo}</td><td class="amount">${row.tipo}</td><td class="amount">${row.cuota}</td></tr>`,
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
        <tr class="total-row"><td colspan="4">Total a deducir</td><td class="amount">${viewModel.totalDeducciones}</td></tr>
      </table>`;
  }

  return `<table>
        ${renderLineItems(viewModel.deducciones)}
        <tr class="total-row"><td>Total a deducir</td><td class="amount">${viewModel.totalDeducciones}</td></tr>
      </table>`;
}

export function buildReceiptHtml(viewModel: ReceiptViewModel): string {
  const { empleador, trabajador, periodo, devengos, totalDevengos, liquidoTotal, lugarYFecha, firmaLabel } = viewModel;

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
      .firma { margin-top: 40px; }
      .firma-line { margin-top: 24px; border-top: 1px solid #111827; width: 60%; }
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
              <tr><td>Nombre</td><td class="amount">${empleador.nombre}</td></tr>
              <tr><td>NIF</td><td class="amount">${empleador.nif}</td></tr>
              <tr><td>Domicilio</td><td class="amount">${empleador.domicilio}</td></tr>
              <tr><td>CCC</td><td class="amount">${empleador.ccc}</td></tr>
            </table>
          </td>
          <td>
            <h2>Datos del trabajador</h2>
            <table>
              <tr><td>Nombre</td><td class="amount">${trabajador.nombre}</td></tr>
              <tr><td>NIF</td><td class="amount">${trabajador.nif}</td></tr>
              <tr><td>NAF</td><td class="amount">${trabajador.naf}</td></tr>
              <tr><td>Grupo de cotización</td><td class="amount">${trabajador.grupoCotizacion}</td></tr>
            </table>
          </td>
        </tr>
      </table>

      <h2>Período de liquidación</h2>
      <table>
        <tr><td>Período</td><td class="amount">${periodo.descripcion}</td></tr>
        ${periodo.rango !== null ? `<tr><td>Rango de días</td><td class="amount">${periodo.rango}</td></tr>` : ''}
        <tr><td>Días trabajados</td><td class="amount">${periodo.diasTrabajados} / ${periodo.diasNaturales} días</td></tr>
        ${periodo.prorrateado ? '<tr><td colspan="2">Mes prorrateado.</td></tr>' : ''}
      </table>

      <h2>Devengos</h2>
      <table>
        ${renderLineItems(devengos)}
        <tr class="total-row"><td>Total devengado</td><td class="amount">${totalDevengos}</td></tr>
      </table>

      <h2>Deducciones</h2>
      ${renderDeducciones(viewModel)}

      <h2>Líquido total a percibir</h2>
      <table>
        <tr class="total-row"><td>Líquido total</td><td class="amount">${liquidoTotal}</td></tr>
      </table>

      <div class="firma">
        <p>${lugarYFecha}</p>
        <div class="firma-line"></div>
        <p>${firmaLabel}</p>
      </div>

      <p class="footnote">
        Este recibo reproduce el formato oficial de Empleados de Hogar a efectos visuales e informativos. NO incluye
        el bloque de determinación de bases y cuotas a cargo de la parte empleadora (cotización empresarial), que
        queda fuera del alcance de esta versión.
      </p>
    </div>
  </body>
</html>`;
}
