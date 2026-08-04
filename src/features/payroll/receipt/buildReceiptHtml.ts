/**
 * Pure HTML template for the "Recibo Individual de Salarios" receipt (design
 * ADR-4). A deterministic function of the view-model only -- no I/O, no
 * clock, no randomness. Self-contained: inline `<style>` only, no external
 * assets/fonts/`http` references (required because `expo-print`'s WebView on
 * Android cannot resolve remote/local-file URLs reliably -- see the adapter's
 * doc comment).
 *
 * Android margin quirk: `FilePrintOptions.margins` is iOS-only, so the page
 * box is controlled entirely via CSS `@page` + a zero-margin `body` plus an
 * inner content wrapper for padding -- the only strategy that is deterministic
 * across the Android WebView print engine (must still be device-verified).
 */

import type { ReceiptLineItem, ReceiptViewModel } from './ReceiptViewModel';

function renderLineItems(items: readonly ReceiptLineItem[]): string {
  return items
    .map((item) => `<tr><td>${item.label}</td><td class="amount">${item.amount}</td></tr>`)
    .join('');
}

export function buildReceiptHtml(viewModel: ReceiptViewModel): string {
  const { empleador, trabajador, periodo, devengos, totalDevengos, deducciones, totalDeducciones, liquidoTotal, lugarYFecha, firmaLabel } =
    viewModel;

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
      td { padding: 2px 0; }
      .amount { text-align: right; }
      .total-row td { font-weight: bold; border-top: 1px solid #111827; }
      .firma { margin-top: 40px; }
      .firma-line { margin-top: 24px; border-top: 1px solid #111827; width: 60%; }
    </style>
  </head>
  <body>
    <div class="content">
      <h1>Recibo Individual de Salarios</h1>

      <h2>Datos del empleador</h2>
      <table>
        <tr><td>Nombre</td><td class="amount">${empleador.nombre}</td></tr>
        <tr><td>NIF</td><td class="amount">${empleador.nif}</td></tr>
        <tr><td>Domicilio</td><td class="amount">${empleador.domicilio}</td></tr>
      </table>

      <h2>Datos del trabajador</h2>
      <table>
        <tr><td>Nombre</td><td class="amount">${trabajador.nombre}</td></tr>
        <tr><td>NIF</td><td class="amount">${trabajador.nif}</td></tr>
        <tr><td>NAF</td><td class="amount">${trabajador.naf}</td></tr>
        <tr><td>Grupo de cotización</td><td class="amount">${trabajador.grupoCotizacion}</td></tr>
      </table>

      <h2>Período de liquidación</h2>
      <table>
        <tr><td>Período</td><td class="amount">${periodo.descripcion}</td></tr>
        <tr><td>Días trabajados</td><td class="amount">${periodo.diasTrabajados} / ${periodo.diasNaturales} días</td></tr>
        ${periodo.prorrateado ? '<tr><td colspan="2">Mes prorrateado.</td></tr>' : ''}
      </table>

      <h2>Devengos</h2>
      <table>
        ${renderLineItems(devengos)}
        <tr class="total-row"><td>Total devengado</td><td class="amount">${totalDevengos}</td></tr>
      </table>

      <h2>Deducciones</h2>
      <table>
        ${renderLineItems(deducciones)}
        <tr class="total-row"><td>Total a deducir</td><td class="amount">${totalDeducciones}</td></tr>
      </table>

      <h2>Líquido total a percibir</h2>
      <table>
        <tr class="total-row"><td>Líquido total</td><td class="amount">${liquidoTotal}</td></tr>
      </table>

      <div class="firma">
        <p>${lugarYFecha}</p>
        <div class="firma-line"></div>
        <p>${firmaLabel}</p>
      </div>
    </div>
  </body>
</html>`;
}
