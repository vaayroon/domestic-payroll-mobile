import { buildReceiptHtml } from './buildReceiptHtml';
import type { ReceiptViewModel } from './ReceiptViewModel';

// Obviously-fake placeholder identifiers/names/amounts only (CLAUDE.md §6).
const FAKE_VIEW_MODEL: ReceiptViewModel = {
  empleador: { nombre: 'Empleador de Prueba', nif: '00000000T', domicilio: 'Calle Falsa 123', ccc: '28123456789' },
  trabajador: { nombre: 'Empleada de Prueba', nif: '00000001T', naf: '000000000001', grupoCotizacion: 'Empleado/a de Hogar' },
  periodo: { descripcion: 'junio de 2026', diasTrabajados: 30, diasNaturales: 30, prorrateado: false, rango: 'del día 1 al 30' },
  devengos: [
    { label: 'Salario base', amount: '900,00 €' },
    { label: 'Prorrata pagas extraordinarias', amount: '150,00 €' },
  ],
  totalDevengos: '1.050,00 €',
  deducciones: [{ label: 'Cuota Seguridad Social (persona trabajadora)', amount: '45,00 €' }],
  deduccionesDesglose: [
    { concepto: 'Contingencias comunes', baseMensual: '970,00 €', basePeriodo: '970,00 €', tipo: '4,70 %', cuota: '45,58 €' },
    { concepto: 'Desempleo', baseMensual: '970,00 €', basePeriodo: '970,00 €', tipo: '1,55 %', cuota: '15,04 €' },
    { concepto: 'MEI (Mecanismo de Equidad Intergeneracional)', baseMensual: '970,00 €', basePeriodo: '970,00 €', tipo: '0,15 %', cuota: '1,46 €' },
  ],
  totalDeducciones: '62,08 €',
  liquidoTotal: '1.005,00 €',
  lugarYFecha: 'En ………, a 4 de agosto de 2026',
  firmaLabel: 'Firma de la persona trabajadora',
};

const FAKE_VIEW_MODEL_NULL_RANGE: ReceiptViewModel = {
  ...FAKE_VIEW_MODEL,
  periodo: { ...FAKE_VIEW_MODEL.periodo, rango: null },
};

const FAKE_VIEW_MODEL_NO_BREAKDOWN: ReceiptViewModel = {
  ...FAKE_VIEW_MODEL,
  deduccionesDesglose: [],
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

  it('includes the required Spanish-labeled sections (SC5, Scenario 11)', () => {
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

  describe('CCC line (Scenario 15)', () => {
    it('renders the CCC value with no "verified" claim', () => {
      expect(html).toContain('CCC');
      expect(html).toContain(FAKE_VIEW_MODEL.empleador.ccc);
      expect(html.toLowerCase()).not.toContain('verificad');
      expect(html.toLowerCase()).not.toContain('verified');
    });
  });

  describe('período literal day-range (Scenarios 12, 13)', () => {
    it('shows the literal day-range line when rango is present (Scenario 12)', () => {
      expect(html).toContain('del día 1 al 30');
    });

    it('omits the day-range line when rango is null (Scenario 13, NULL-range legacy run)', () => {
      const htmlNullRange = buildReceiptHtml(FAKE_VIEW_MODEL_NULL_RANGE);
      expect(htmlNullRange).not.toContain('del día');
      // días trabajados/naturales still render.
      expect(htmlNullRange).toContain('30 / 30 días');
    });
  });

  describe('worker deduction breakdown by contingency', () => {
    it('renders the itemized breakdown rows with concepto/base/tipo/cuota when present', () => {
      expect(html).toContain('Contingencias comunes');
      expect(html).toContain('Desempleo');
      expect(html).toContain('MEI (Mecanismo de Equidad Intergeneracional)');
      expect(html).toContain('4,70 %');
      expect(html).toContain('1,55 %');
      expect(html).toContain('0,15 %');
      expect(html).toContain('45,58 €');
      expect(html).toContain('15,04 €');
      expect(html).toContain('1,46 €');
    });

    it('falls back to the single lump SS line when deduccionesDesglose is empty (ratesConfig unavailable)', () => {
      const htmlNoBreakdown = buildReceiptHtml(FAKE_VIEW_MODEL_NO_BREAKDOWN);
      expect(htmlNoBreakdown).toContain('Cuota Seguridad Social (persona trabajadora)');
      expect(htmlNoBreakdown).not.toContain('Contingencias comunes');
    });

    it('renders both dual-base column headers (Base mensual, Base del periodo) (R3)', () => {
      expect(html).toContain('Base mensual');
      expect(html).toContain('Base del periodo');
    });

    it('emits exactly 5 <td> cells per desglose row (concepto, baseMensual, basePeriodo, tipo, cuota) (R3)', () => {
      const comunesRowMatch = html.match(/<tr><td>Contingencias comunes<\/td>.*?<\/tr>/);
      expect(comunesRowMatch).not.toBeNull();
      const tdCount = (comunesRowMatch?.[0].match(/<td/g) ?? []).length;
      expect(tdCount).toBe(5);
    });

    it('the desglose total row spans 4 columns (colspan="4") (R3)', () => {
      expect(html).toContain('<td colspan="4">Total a deducir</td>');
    });
  });

  describe('employer-contribution out-of-scope footnote (Scenario 11)', () => {
    it('renders a visible note stating the employer-contribution block is not included', () => {
      expect(html.toLowerCase()).toContain('determinación de bases');
      expect(html.toLowerCase()).toContain('fuera del alcance');
    });
  });
});
