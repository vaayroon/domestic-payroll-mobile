import { buildReceiptHtml } from './buildReceiptHtml';
import type { ReceiptViewModel } from './ReceiptViewModel';

// Obviously-fake placeholder identifiers/names/amounts only (CLAUDE.md §6).
const FAKE_VIEW_MODEL: ReceiptViewModel = {
  empleador: { nombre: 'Empleador de Prueba', nif: '00000000T', domicilio: 'Calle Falsa 123' },
  trabajador: { nombre: 'Empleada de Prueba', nif: '00000001T', naf: '000000000001', grupoCotizacion: 'Empleado/a de Hogar' },
  periodo: { descripcion: 'junio de 2026', diasTrabajados: 30, diasNaturales: 30, prorrateado: false },
  devengos: [
    { label: 'Salario base', amount: '900,00 €' },
    { label: 'Prorrata pagas extraordinarias', amount: '150,00 €' },
  ],
  totalDevengos: '1.050,00 €',
  deducciones: [{ label: 'Cuota Seguridad Social (persona trabajadora)', amount: '45,00 €' }],
  totalDeducciones: '45,00 €',
  liquidoTotal: '1.005,00 €',
  lugarYFecha: 'En ………, a 4 de agosto de 2026',
  firmaLabel: 'Firma de la persona trabajadora',
};

describe('buildReceiptHtml', () => {
  const html = buildReceiptHtml(FAKE_VIEW_MODEL);

  it('produces a self-contained document with no external URL/asset references (SC4)', () => {
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/@font-face/i);
  });

  it('includes an inline <style> block and the doctype', () => {
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<style>');
  });

  it('includes the required Spanish-labeled sections (SC5)', () => {
    expect(html).toContain('Datos del empleador');
    expect(html).toContain('Datos del trabajador');
    expect(html).toContain('Período de liquidación');
    expect(html).toContain('Devengos');
    expect(html).toContain('Deducciones');
    expect(html).toContain('Líquido total a percibir');
    expect(html).toContain(FAKE_VIEW_MODEL.firmaLabel);
  });

  it('renders every devengo/deduccion line item and their totals', () => {
    expect(html).toContain('Salario base');
    expect(html).toContain('Prorrata pagas extraordinarias');
    expect(html).toContain(FAKE_VIEW_MODEL.totalDevengos);
    expect(html).toContain('Cuota Seguridad Social (persona trabajadora)');
    expect(html).toContain(FAKE_VIEW_MODEL.totalDeducciones);
    expect(html).toContain(FAKE_VIEW_MODEL.liquidoTotal);
  });

  it('renders the Android margin-quirk CSS strategy (@page + zero body margin)', () => {
    expect(html).toContain('@page');
    expect(html).toContain('margin: 0');
  });

  it('is deterministic given the same view-model', () => {
    expect(buildReceiptHtml(FAKE_VIEW_MODEL)).toBe(buildReceiptHtml(FAKE_VIEW_MODEL));
  });
});
