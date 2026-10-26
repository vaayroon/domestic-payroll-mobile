import { SYNTHETIC_SIGNATURE_PNG_BASE64 } from '@/core/testing/fixtures';
import { buildReceiptHtml } from './buildReceiptHtml';
import type {
  ReceiptEmpleadorCotizacion,
  ReceiptEmpleadorCotizacionNoDisponibleReason,
  ReceiptViewModel,
} from './ReceiptViewModel';

// Obviously-fake placeholder identifiers/names/amounts only (CLAUDE.md §6).
const FAKE_VIEW_MODEL: ReceiptViewModel = {
  empleador: { nombre: 'Empleador de Prueba', nif: '00000000T', domicilio: 'Calle Falsa 123', ccc: '28123456789' },
  trabajador: {
    nombre: 'Empleada de Prueba',
    nif: '00000001T',
    naf: '000000000001',
    grupoProfesional: 'Empleado/a de Hogar',
    grupoCotizacion: '7',
  },
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
  empleadorCotizacion: {
    kind: 'figures',
    filas: [
      { concepto: 'Contingencias comunes', basePeriodo: '1424,50 €', tipo: '23,60 %', cuota: '336,18 €' },
      { concepto: 'Contingencias profesionales (AT y EP)', basePeriodo: '1424,50 €', tipo: '1,50 %', cuota: '21,37 €' },
      { concepto: 'Desempleo', basePeriodo: '1424,50 €', tipo: '5,50 %', cuota: '78,35 €' },
      { concepto: 'FOGASA (Fondo de Garantía Salarial)', basePeriodo: '1424,50 €', tipo: '0,20 %', cuota: '2,85 €' },
      { concepto: 'MEI (Mecanismo de Equidad Intergeneracional)', basePeriodo: '1424,50 €', tipo: '0,75 %', cuota: '10,68 €' },
    ],
    beneficios: [
      { concepto: 'Reducción por contingencias comunes', cuotaAfectada: '336,18 €', tipo: '20 %', importe: '-67,24 €' },
      { concepto: 'Bonificación por desempleo y FOGASA', cuotaAfectada: '81,20 €', tipo: '80 %', importe: '-64,96 €' },
    ],
    totalNominal: '449,43 €',
    totalEfectivo: '317,23 €',
  },
  lugarYFecha: 'En ………, a 4 de agosto de 2026',
  firmaLabel: 'Firma de la persona trabajadora',
  empleadorFirmaImagenBase64: null,
  empleadorFirmaLabel: 'Firma de la parte empleadora',
};

const FAKE_VIEW_MODEL_NULL_RANGE: ReceiptViewModel = {
  ...FAKE_VIEW_MODEL,
  periodo: { ...FAKE_VIEW_MODEL.periodo, rango: null },
};

// The `ratesConfig === null` state: no worker breakdown AND no employer figures,
// exactly as `buildReceiptViewModel` emits them together.
const FAKE_VIEW_MODEL_NO_BREAKDOWN: ReceiptViewModel = {
  ...FAKE_VIEW_MODEL,
  deduccionesDesglose: [],
  empleadorCotizacion: {
    kind: 'unavailable',
    reason: 'rates_unavailable',
    nota: 'Nota de prueba: tipos de cotización no disponibles.',
  },
};

/** Distinct fake note per reason, so a test can tell which one reached the document. */
function unavailableViewModel(reason: ReceiptEmpleadorCotizacionNoDisponibleReason): ReceiptViewModel {
  return {
    ...FAKE_VIEW_MODEL,
    empleadorCotizacion: { kind: 'unavailable', reason, nota: `Nota de prueba (${reason}).` },
  };
}

// Golden vector, TEMPORAL (spec D5.1): only desempleo and the figures derived from it change.
const FAKE_VIEW_MODEL_TEMPORAL: ReceiptViewModel = {
  ...FAKE_VIEW_MODEL,
  empleadorCotizacion: {
    kind: 'figures',
    filas: [
      { concepto: 'Contingencias comunes', basePeriodo: '1424,50 €', tipo: '23,60 %', cuota: '336,18 €' },
      { concepto: 'Contingencias profesionales (AT y EP)', basePeriodo: '1424,50 €', tipo: '1,50 %', cuota: '21,37 €' },
      { concepto: 'Desempleo', basePeriodo: '1424,50 €', tipo: '6,70 %', cuota: '95,44 €' },
      { concepto: 'FOGASA (Fondo de Garantía Salarial)', basePeriodo: '1424,50 €', tipo: '0,20 %', cuota: '2,85 €' },
      { concepto: 'MEI (Mecanismo de Equidad Intergeneracional)', basePeriodo: '1424,50 €', tipo: '0,75 %', cuota: '10,68 €' },
    ],
    beneficios: [
      { concepto: 'Reducción por contingencias comunes', cuotaAfectada: '336,18 €', tipo: '20 %', importe: '-67,24 €' },
      { concepto: 'Bonificación por desempleo y FOGASA', cuotaAfectada: '98,29 €', tipo: '80 %', importe: '-78,63 €' },
    ],
    totalNominal: '466,52 €',
    totalEfectivo: '320,65 €',
  },
};

/** The employer section only: from its wrapper to the start of the firma block. */
function employerBlock(document: string): string {
  const start = document.indexOf('<div class="empleador-cotizacion">');
  const end = document.indexOf('<div class="firma">');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return document.slice(start, end);
}

/**
 * One header box (`Datos del trabajador`), sliced out by its heading. `NIF` is
 * a label in BOTH header boxes, so a lookup over the whole document is wrong:
 * always slice first. Labels are static literals and are matched raw.
 */
function headerBox(
  document: string,
  heading: string,
): { readonly rowCount: number; readonly rows: readonly { readonly label: string; readonly value: string }[] } {
  const start = document.indexOf(`<h2>${heading}</h2>`);
  expect(start).toBeGreaterThan(-1);
  const end = document.indexOf('</table>', start);
  expect(end).toBeGreaterThan(start);
  const box = document.slice(start, end);
  return {
    rowCount: (box.match(/<tr>/g) ?? []).length,
    rows: [...box.matchAll(/<tr><td>([^<]*)<\/td><td class="amount">([^<]*)<\/td><\/tr>/g)].map((match) => ({
      label: match[1] ?? '',
      value: match[2] ?? '',
    })),
  };
}

/** Hostile value (markup characters + quotes) and the exact form `escapeHtml` must emit for it. */
function hostile(tag: string): { readonly raw: string; readonly escaped: string } {
  return {
    raw: `<script>${tag}</script> & "q"`,
    escaped: `&lt;script&gt;${tag}&lt;/script&gt; &amp; &quot;q&quot;`,
  };
}

const FAKE_VIEW_MODEL_WITH_SIGNATURE: ReceiptViewModel = {
  ...FAKE_VIEW_MODEL,
  empleadorFirmaImagenBase64: SYNTHETIC_SIGNATURE_PNG_BASE64,
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

  describe('HTML escaping of interpolated values', () => {
    // Obviously-fake placeholders chosen to contain the characters that break markup.
    const FAKE_VIEW_MODEL_WITH_MARKUP_CHARS: ReceiptViewModel = {
      ...FAKE_VIEW_MODEL,
      empleador: {
        ...FAKE_VIEW_MODEL.empleador,
        nombre: 'Pérez & Hijos <SL>',
        domicilio: 'Calle "Falsa" 123 & 4',
      },
      lugarYFecha: 'En Villa & Corte, a 4 de agosto de 2026',
    };

    it('escapes markup characters instead of emitting them raw', () => {
      const html = buildReceiptHtml(FAKE_VIEW_MODEL_WITH_MARKUP_CHARS);

      expect(html).toContain('Pérez &amp; Hijos &lt;SL&gt;');
      expect(html).toContain('Calle &quot;Falsa&quot; 123 &amp; 4');
      expect(html).toContain('En Villa &amp; Corte, a 4 de agosto de 2026');

      // The raw forms must NOT survive into the document.
      expect(html).not.toContain('Pérez & Hijos <SL>');
      expect(html).not.toContain('Calle "Falsa" 123 & 4');
    });

    it('does not introduce a stray tag from a value containing angle brackets', () => {
      const html = buildReceiptHtml(FAKE_VIEW_MODEL_WITH_MARKUP_CHARS);

      expect(html).not.toContain('<SL>');
    });

    it('leaves ordinary values byte-identical', () => {
      const html = buildReceiptHtml(FAKE_VIEW_MODEL);

      expect(html).toContain('Empleador de Prueba');
      expect(html).toContain('Calle Falsa 123');
      expect(html).toContain('1.050,00 €');
    });
  });

  describe('worker box, annex rows in annex order (spec W1, W3, X1.2)', () => {
    const WORKER_LABELS = [
      'Trabajador',
      'NIF',
      'Núm. Afil. Seguridad Social',
      'Grupo profesional',
      'Grupo de cotización',
    ];

    it('prints exactly five rows, labelled and ordered as the annex (W1.1)', () => {
      const box = headerBox(html, 'Datos del trabajador');

      expect(box.rowCount).toBe(5);
      expect(box.rows.map((row) => row.label)).toEqual(WORKER_LABELS);
    });

    it('keeps each value under its own label', () => {
      const values = Object.fromEntries(
        headerBox(html, 'Datos del trabajador').rows.map((row) => [row.label, row.value]),
      );

      expect(values).toEqual({
        Trabajador: 'Empleada de Prueba',
        NIF: '00000001T',
        'Núm. Afil. Seguridad Social': '000000000001',
        'Grupo profesional': 'Empleado/a de Hogar',
        'Grupo de cotización': '7',
      });
    });

    it('puts Empleado/a de Hogar under Grupo profesional only, never under Grupo de cotización (W1.2)', () => {
      const rows = headerBox(html, 'Datos del trabajador').rows;

      expect(rows.filter((row) => row.value.includes('Empleado/a de Hogar')).map((row) => row.label)).toEqual([
        'Grupo profesional',
      ]);
    });

    it('no longer prints Nombre or NAF as a label in the worker box (W1.3)', () => {
      const labels = headerBox(html, 'Datos del trabajador').rows.map((row) => row.label);

      expect(labels).not.toContain('Nombre');
      expect(labels).not.toContain('NAF');
    });

    it('prints a null grupo de cotización as the placeholder, not an empty cell and not "null" (W3.2)', () => {
      const document = buildReceiptHtml({
        ...FAKE_VIEW_MODEL,
        trabajador: { ...FAKE_VIEW_MODEL.trabajador, grupoCotizacion: '—' },
      });
      const row = headerBox(document, 'Datos del trabajador').rows.find((r) => r.label === 'Grupo de cotización');

      expect(row?.value).toBe('—');
      expect(document).not.toContain('>null<');
    });

    it('prints a long mixed grupo de cotización in full (W3.3)', () => {
      const document = buildReceiptHtml({
        ...FAKE_VIEW_MODEL,
        trabajador: { ...FAKE_VIEW_MODEL.trabajador, grupoCotizacion: 'Grupo 10 — Peones' },
      });
      const row = headerBox(document, 'Datos del trabajador').rows.find((r) => r.label === 'Grupo de cotización');

      expect(row?.value).toBe('Grupo 10 — Peones');
    });

    it('escapes the two group values, which are interpolated (X1.1)', () => {
      const grupoCotizacion = hostile('gc');
      const grupoProfesional = hostile('gp');
      const document = buildReceiptHtml({
        ...FAKE_VIEW_MODEL,
        // The literal type forbids this everywhere else; the cast is test-only.
        trabajador: {
          ...FAKE_VIEW_MODEL.trabajador,
          grupoProfesional: grupoProfesional.raw as ReceiptViewModel['trabajador']['grupoProfesional'],
          grupoCotizacion: grupoCotizacion.raw,
        },
      });

      expect(document).not.toContain('<script>');
      expect(document).toContain(grupoCotizacion.escaped);
      expect(document).toContain(grupoProfesional.escaped);
    });

    it('prints the label raw and only the value escaped (X1.2)', () => {
      const naf = hostile('naf');
      const document = buildReceiptHtml({
        ...FAKE_VIEW_MODEL,
        trabajador: { ...FAKE_VIEW_MODEL.trabajador, naf: naf.raw },
      });

      expect(document).toContain(
        `<tr><td>Núm. Afil. Seguridad Social</td><td class="amount">${naf.escaped}</td></tr>`,
      );
      expect(document).not.toContain(naf.raw);
      // Nothing about the label was turned into an entity.
      expect(document).not.toMatch(/N&[a-z#0-9]+;m\./);
    });
  });

  describe('employer box, annex rows in annex order (spec E1-E4)', () => {
    // Pairwise-distinct, obviously fake sentinels so a swapped value cannot hide.
    const SENTINEL_VIEW_MODEL: ReceiptViewModel = {
      ...FAKE_VIEW_MODEL,
      empleador: {
        nombre: 'EMPLEADOR-NOMBRE-FICTICIO',
        domicilio: 'EMPLEADOR-DOMICILIO-FICTICIO',
        nif: 'EMPLEADOR-NIF-FICTICIO',
        ccc: 'EMPLEADOR-CCC-FICTICIO',
      },
      trabajador: { ...FAKE_VIEW_MODEL.trabajador, nif: 'TRABAJADOR-NIF-FICTICIO' },
    };
    const sentinelHtml = buildReceiptHtml(SENTINEL_VIEW_MODEL);

    it('prints exactly four rows, labelled and ordered as the annex (E1.1)', () => {
      const box = headerBox(html, 'Datos del empleador');

      expect(box.rowCount).toBe(4);
      expect(box.rows.map((row) => row.label)).toEqual(['Empresa', 'Domicilio', 'NIF', 'CCC']);
    });

    it('no longer puts the identifier before the address (E1.2)', () => {
      const labels = headerBox(html, 'Datos del empleador').rows.map((row) => row.label);

      expect(labels.indexOf('Domicilio')).toBeGreaterThan(-1);
      expect(labels.indexOf('Domicilio')).toBeLessThan(labels.indexOf('NIF'));
    });

    it('prints neither Nombre nor CIF as a label in the employer box (E2.1)', () => {
      const labels = headerBox(html, 'Datos del empleador').rows.map((row) => row.label);

      expect(labels).not.toContain('Nombre');
      expect(labels).not.toContain('CIF');
    });

    it('keeps the first label bare and the heading unchanged (E2.2)', () => {
      expect(headerBox(html, 'Datos del empleador').rows[0]?.label).toBe('Empresa');
      expect(html).toContain('<h2>Datos del empleador</h2>');
    });

    it('keeps every value under its own label (E3.1)', () => {
      const values = Object.fromEntries(
        headerBox(sentinelHtml, 'Datos del empleador').rows.map((row) => [row.label, row.value]),
      );

      expect(values).toEqual({
        Empresa: 'EMPLEADOR-NOMBRE-FICTICIO',
        Domicilio: 'EMPLEADOR-DOMICILIO-FICTICIO',
        NIF: 'EMPLEADOR-NIF-FICTICIO',
        CCC: 'EMPLEADOR-CCC-FICTICIO',
      });
    });

    it('prints NIF once per box, each holding its own party value (E3.2)', () => {
      const employerNif = headerBox(sentinelHtml, 'Datos del empleador').rows.filter((row) => row.label === 'NIF');
      const workerNif = headerBox(sentinelHtml, 'Datos del trabajador').rows.filter((row) => row.label === 'NIF');

      expect(employerNif.map((row) => row.value)).toEqual(['EMPLEADOR-NIF-FICTICIO']);
      expect(workerNif.map((row) => row.value)).toEqual(['TRABAJADOR-NIF-FICTICIO']);
    });

    it('still escapes every employer value (X1)', () => {
      const nombre = hostile('nom');
      const document = buildReceiptHtml({
        ...FAKE_VIEW_MODEL,
        empleador: { ...FAKE_VIEW_MODEL.empleador, nombre: nombre.raw },
      });

      expect(document).toContain(`<tr><td>Empresa</td><td class="amount">${nombre.escaped}</td></tr>`);
      expect(document).not.toContain(nombre.raw);
    });

    it('introduces no URL and no "verificad" claim through the labels (E4.2)', () => {
      expect(html).not.toMatch(/https?:\/\//i);
      expect(html.toLowerCase()).not.toContain('verificad');
    });
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

  // REPLACES the former Scenario 11 test, which asserted the "out of scope"
  // disclaimer. The block now exists, so the assertions describe the new state:
  // the section is present, the old admission is gone, and the legal basis cites
  // norms by BOE id. The negative assertions are scoped to the figures branch;
  // the no-figures notes are different strings with their own tests below.
  describe('employer-contribution block replaces the out-of-scope footnote (Scenario 11, spec V2.1)', () => {
    it('renders the employer section and its effective total on the figures branch', () => {
      expect(html.toLowerCase()).toContain('determinación de bases');
      expect(html).toContain('317,23 €');
    });

    it('no longer renders the disclaimer that the block is not included', () => {
      const lower = html.toLowerCase();
      expect(lower).not.toContain('fuera del alcance');
      expect(lower).not.toContain('no incluye');
      expect(lower).not.toContain('a efectos visuales');
    });

    it('replaces it with a legal-basis footnote citing norms by BOE id, not by URL', () => {
      expect(html).toContain('<p class="footnote">');
      expect(html).toContain('BOE-A-2026-7296');
      expect(html).toContain('BOE-A-2026-2548');
      expect(html).toContain('BOE-A-2022-14680');
      expect(html).toContain('no sustituyen a la liquidación de la Tesorería General de la Seguridad Social');
      expect(html).not.toMatch(/https?:\/\//i);
    });

    // Every rate printed in the block must be traceable from the footnote.
    // Orden PJC/297/2026 splits them across three articles: art. 15 (contingencias
    // comunes and AT y EP), art. 16 (MEI) and art. 35 (desempleo and FOGASA). The
    // footnote first shipped citing only arts. 15 and 35, so the printed MEI row
    // had no article behind it. Nothing guarded the list; this is that guard.
    it('cites every article the printed rates come from, MEI included', () => {
      expect(html).toContain('arts. 15, 16 y 35');
    });
  });

  describe('employer contribution block, figures branch (spec V1.1)', () => {
    it('renders the five nominal cuotas with their tipo strings', () => {
      const block = employerBlock(html);
      for (const fragment of [
        'Contingencias comunes',
        '23,60 %',
        '336,18 €',
        'Contingencias profesionales (AT y EP)',
        '1,50 %',
        '21,37 €',
        'Desempleo',
        '5,50 %',
        '78,35 €',
        'FOGASA (Fondo de Garantía Salarial)',
        '0,20 %',
        '2,85 €',
        'MEI (Mecanismo de Equidad Intergeneracional)',
        '0,75 %',
        '10,68 €',
      ]) {
        expect(block).toContain(fragment);
      }
    });

    it('renders both benefits as negatives, the nominal subtotal and the effective total', () => {
      const block = employerBlock(html);
      expect(block).toContain('-67,24 €');
      expect(block).toContain('-64,96 €');
      expect(block).toContain('Cuota de la parte empleadora');
      expect(block).toContain('449,43 €');
      expect(block).toContain('Total a ingresar por la parte empleadora');
      expect(block).toContain('317,23 €');
    });

    it('places the section after the liquido total and before the firma block, in document order', () => {
      const liquido = html.indexOf('Líquido total a percibir');
      const empleador = html.indexOf('<div class="empleador-cotizacion">');
      const firma = html.indexOf('<div class="firma">');
      expect(liquido).toBeGreaterThan(-1);
      expect(empleador).toBeGreaterThan(liquido);
      expect(firma).toBeGreaterThan(empleador);
    });

    it('lists nominal rows first, then the benefits sub-header and rows, then the effective total', () => {
      const block = employerBlock(html);
      const order = [
        block.indexOf('Contingencias comunes'),
        block.indexOf('MEI (Mecanismo de Equidad Intergeneracional)'),
        block.indexOf('Cuota de la parte empleadora'),
        block.indexOf('Beneficios en la cotización'),
        block.indexOf('Reducción por contingencias comunes'),
        block.indexOf('Bonificación por desempleo y FOGASA'),
        block.indexOf('Total a ingresar por la parte empleadora'),
      ];
      expect(order.every((position) => position > -1)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it('relabels the benefit columns so a cuota never sits under a "Base del periodo" header', () => {
      const block = employerBlock(html);
      expect(block).toContain('<th class="amount">Cuota afectada</th>');
      expect(block).toContain('<th class="amount">Importe</th>');
      // The benefit operand shown is the displayed CC cuota / desempleo + FOGASA sum.
      expect(block).toContain('<td class="amount">81,20 €</td>');
    });

    it('emits exactly 4 <td> cells per nominal and per benefit row, in ONE table', () => {
      const block = employerBlock(html);
      expect(block.match(/<table/g)).toHaveLength(1);

      const nominalRows = block.match(/<tr><td>.*?<\/tr>/g) ?? [];
      expect(nominalRows).toHaveLength(5);
      const benefitRows = block.match(/<tr class="beneficio">.*?<\/tr>/g) ?? [];
      expect(benefitRows).toHaveLength(2);
      for (const row of [...nominalRows, ...benefitRows]) {
        expect(row.match(/<td/g)).toHaveLength(4);
      }
    });

    it('the subtotal and total rows span the three label columns (colspan="3")', () => {
      const block = employerBlock(html);
      expect(block).toContain('<td colspan="3">Cuota de la parte empleadora</td>');
      expect(block).toContain('<td colspan="3">Total a ingresar por la parte empleadora</td>');
    });
  });

  describe('employer contribution block, benefit scope (spec V1.2)', () => {
    it('ties the 20 % row to contingencias comunes and the 80 % row to desempleo and FOGASA, never MEI or AT y EP', () => {
      const benefitRows = employerBlock(html).match(/<tr class="beneficio">.*?<\/tr>/g) ?? [];
      expect(benefitRows).toHaveLength(2);

      const [reduccion, bonificacion] = benefitRows;
      expect(reduccion).toContain('Reducción por contingencias comunes');
      expect(reduccion).toContain('20 %');
      expect(bonificacion).toContain('Bonificación por desempleo y FOGASA');
      expect(bonificacion).toContain('80 %');
      for (const row of benefitRows) {
        expect(row).not.toContain('MEI');
        expect(row).not.toContain('AT y EP');
      }
    });
  });

  describe('employer contribution block, TEMPORAL (spec V1.3)', () => {
    it('shows the 6,70 % desempleo tipo with cuota 95,44 and the 320,65 effective total', () => {
      const block = employerBlock(buildReceiptHtml(FAKE_VIEW_MODEL_TEMPORAL));
      expect(block).toContain('6,70 %');
      expect(block).toContain('95,44 €');
      expect(block).toContain('466,52 €');
      expect(block).toContain('-78,63 €');
      expect(block).toContain('320,65 €');
      expect(block).not.toContain('5,50 %');
    });
  });

  describe('employer contribution block, no-figures branch (spec V3.1, V4.2, V5.1)', () => {
    const reasons: readonly ReceiptEmpleadorCotizacionNoDisponibleReason[] = [
      'rates_unavailable',
      'base_drifted',
      'base_not_verifiable',
    ];

    it.each(reasons)('%s: renders its note and NO rows, benefits, totals or legal footnote', (reason) => {
      const document = buildReceiptHtml(unavailableViewModel(reason));
      const block = employerBlock(document);

      expect(block).toContain(`Nota de prueba (${reason}).`);
      expect(block).toContain('Determinación de bases y cuotas');
      expect(block).not.toContain('<table');
      expect(block).not.toContain('<tr');

      // None of the figures from the default view-model can leak through.
      for (const figure of ['336,18', '449,43', '317,23', '67,24', '64,96']) {
        expect(document).not.toContain(figure);
      }
      expect(document).not.toContain('Cuota de la parte empleadora');
      expect(document).not.toContain('Total a ingresar por la parte empleadora');
      expect(document).not.toContain('class="beneficio"');

      // The legal footnote describes figures, so it is absent beside a no-figures note.
      expect(document).not.toContain('class="footnote"');
      expect(document).not.toContain('BOE-A-2026-7296');
    });

    it('the three reasons render distinct notes (a legacy run is distinguishable from drift)', () => {
      const [rates, drifted, legacy] = reasons.map((reason) => employerBlock(buildReceiptHtml(unavailableViewModel(reason))));
      expect(new Set([rates, drifted, legacy]).size).toBe(3);
    });

    it('rates_unavailable still renders the worker lump SS deduction line, without crashing', () => {
      const document = buildReceiptHtml(FAKE_VIEW_MODEL_NO_BREAKDOWN);
      expect(document).toContain('Cuota Seguridad Social (persona trabajadora)');
      expect(document).toContain('Nota de prueba: tipos de cotización no disponibles.');
      expect(document).not.toContain('Cuota de la parte empleadora');
    });

    it('is deterministic for each reason', () => {
      for (const reason of reasons) {
        expect(buildReceiptHtml(unavailableViewModel(reason))).toBe(buildReceiptHtml(unavailableViewModel(reason)));
      }
    });
  });

  describe('employer contribution block, HTML escaping of every new field (spec V6.1)', () => {
    it('escapes concepto, basePeriodo, tipo and cuota of nominal rows, and both totals', () => {
      const [concepto, basePeriodo, tipo, cuota, totalNominal, totalEfectivo] = [
        hostile('concepto'),
        hostile('basePeriodo'),
        hostile('tipo'),
        hostile('cuota'),
        hostile('totalNominal'),
        hostile('totalEfectivo'),
      ];
      const cotizacion: ReceiptEmpleadorCotizacion = {
        kind: 'figures',
        filas: [{ concepto: concepto.raw, basePeriodo: basePeriodo.raw, tipo: tipo.raw, cuota: cuota.raw }],
        beneficios: [],
        totalNominal: totalNominal.raw,
        totalEfectivo: totalEfectivo.raw,
      };
      const document = buildReceiptHtml({ ...FAKE_VIEW_MODEL, empleadorCotizacion: cotizacion });

      for (const field of [concepto, basePeriodo, tipo, cuota, totalNominal, totalEfectivo]) {
        expect(document).toContain(field.escaped);
        expect(document).not.toContain(field.raw);
      }
      expect(document).not.toMatch(/<script\b/i);
    });

    it('escapes concepto, cuotaAfectada, tipo and importe of benefit rows', () => {
      const [concepto, cuotaAfectada, tipo, importe] = [
        hostile('bConcepto'),
        hostile('bCuotaAfectada'),
        hostile('bTipo'),
        hostile('bImporte'),
      ];
      const cotizacion: ReceiptEmpleadorCotizacion = {
        kind: 'figures',
        filas: [],
        beneficios: [{ concepto: concepto.raw, cuotaAfectada: cuotaAfectada.raw, tipo: tipo.raw, importe: importe.raw }],
        totalNominal: '0,00 €',
        totalEfectivo: '0,00 €',
      };
      const document = buildReceiptHtml({ ...FAKE_VIEW_MODEL, empleadorCotizacion: cotizacion });

      for (const field of [concepto, cuotaAfectada, tipo, importe]) {
        expect(document).toContain(field.escaped);
        expect(document).not.toContain(field.raw);
      }
      expect(document).not.toMatch(/<script\b/i);
    });

    it.each(['rates_unavailable', 'base_drifted', 'base_not_verifiable'] as const)('escapes the %s note', (reason) => {
      const nota = hostile(`nota-${reason}`);
      const document = buildReceiptHtml({
        ...FAKE_VIEW_MODEL,
        empleadorCotizacion: { kind: 'unavailable', reason, nota: nota.raw },
      });

      expect(document).toContain(nota.escaped);
      expect(document).not.toContain(nota.raw);
      expect(document).not.toMatch(/<script\b/i);
    });
  });

  describe('print-layout guards on the new markup (spec V7.1, design §6)', () => {
    it('keeps the employer block whole via page-break-inside: avoid on the wrapper div, never on the table', () => {
      expect(html).toMatch(/\.empleador-cotizacion \{[^}]*page-break-inside: avoid/);
      expect(html).not.toMatch(/(^|[\s,}])table\s*\{[^}]*page-break-inside/);
    });

    it('scopes the column widths and nowrap to the employer block', () => {
      expect(html).toMatch(/\.empleador-cotizacion td:first-child \{[^}]*width: 46%/);
      expect(html).toMatch(/\.empleador-cotizacion \.amount \{[^}]*white-space: nowrap/);
    });

    it('protects the whole .firma block, so lugarYFecha cannot be orphaned from the grid', () => {
      expect(html).toMatch(/\.firma \{[^}]*page-break-inside: avoid/);
      expect(html).toMatch(/\.firma-grid \{[^}]*page-break-inside: avoid/);
    });

    const matrix: readonly (readonly [string, ReceiptViewModel])[] = [
      ['figures, no signature', FAKE_VIEW_MODEL],
      ['figures, saved signature', FAKE_VIEW_MODEL_WITH_SIGNATURE],
      ['TEMPORAL figures', FAKE_VIEW_MODEL_TEMPORAL],
      ['rates_unavailable', FAKE_VIEW_MODEL_NO_BREAKDOWN],
      ['base_drifted', unavailableViewModel('base_drifted')],
      ['base_not_verifiable', unavailableViewModel('base_not_verifiable')],
      ['base_drifted with signature', { ...unavailableViewModel('base_drifted'), empleadorFirmaImagenBase64: SYNTHETIC_SIGNATURE_PNG_BASE64 }],
    ];

    it.each(matrix)('%s: no URL, no "verificad", firma grid and avoid rules present', (_label, viewModel) => {
      const document = buildReceiptHtml(viewModel);
      expect(document).not.toMatch(/https?:\/\//i);
      expect(document.toLowerCase()).not.toContain('verificad');
      expect(document).toContain('.firma-grid');
      expect(document).toContain('page-break-inside: avoid');
      expect(document).toContain('<div class="firma">');
      expect(document.includes('<img')).toBe(viewModel.empleadorFirmaImagenBase64 !== null);
    });
  });

  describe('two-column employer/worker signature grid', () => {
    it('with a signature: embeds an inline data URI image in the employer column', () => {
      const htmlWithSignature = buildReceiptHtml(FAKE_VIEW_MODEL_WITH_SIGNATURE);
      expect(htmlWithSignature).toContain(`data:image/png;base64,${SYNTHETIC_SIGNATURE_PNG_BASE64}`);
      expect(htmlWithSignature).toContain('class="firma-image"');
      expect(htmlWithSignature).toContain('alt=""');
    });

    it('without a signature: renders no <img>, and the employer blank line + label', () => {
      expect(html).not.toContain('<img');
      expect(html).toContain(FAKE_VIEW_MODEL.empleadorFirmaLabel);
    });

    it('both states: the worker line and label are preserved verbatim', () => {
      const htmlWithSignature = buildReceiptHtml(FAKE_VIEW_MODEL_WITH_SIGNATURE);
      for (const document of [html, htmlWithSignature]) {
        expect(document).toContain('<div class="firma-line"></div>');
        expect(document).toContain('Firma de la persona trabajadora');
      }
    });

    it('both states: lugarYFecha renders exactly once', () => {
      const htmlWithSignature = buildReceiptHtml(FAKE_VIEW_MODEL_WITH_SIGNATURE);
      for (const document of [html, htmlWithSignature]) {
        expect(document.split(FAKE_VIEW_MODEL.lugarYFecha).length).toBe(2);
      }
    });

    it('renders the firma-grid CSS with bottom-aligned columns', () => {
      expect(html).toContain('.firma-grid');
      expect(html).toContain('vertical-align: bottom');
    });

    it('bounds the image via CSS max-width/max-height, never raw width/height attributes', () => {
      const htmlWithSignature = buildReceiptHtml(FAKE_VIEW_MODEL_WITH_SIGNATURE);
      expect(htmlWithSignature).toContain('max-width');
      expect(htmlWithSignature).toContain('max-height');
      expect(htmlWithSignature).not.toMatch(/<img[^>]*\swidth=/);
      expect(htmlWithSignature).not.toMatch(/<img[^>]*\sheight=/);
    });

    it('stays self-contained with an embedded signature (SC4 regression)', () => {
      const htmlWithSignature = buildReceiptHtml(FAKE_VIEW_MODEL_WITH_SIGNATURE);
      expect(htmlWithSignature).not.toMatch(/https?:\/\//i);
      expect(htmlWithSignature).not.toMatch(/<link\b/i);
      expect(htmlWithSignature).not.toMatch(/<script\b/i);
      expect(htmlWithSignature).not.toMatch(/@font-face/i);
    });
  });
});
