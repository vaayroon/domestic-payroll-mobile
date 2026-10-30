import type { SettingsRepository } from '@/types';

import { InMemorySettingsRepository } from './testing/fakes';
import {
  buildReceiptFileName,
  isSafeReceiptFileName,
  parseReceiptFileNameFormat,
  readReceiptFileNameFormat,
  RECEIPT_FILE_NAME_FORMAT_EXAMPLES,
  RECEIPT_FILE_NAME_FORMAT_IDS,
  RECEIPT_FILE_NAME_FORMAT_KEY,
  resolveReceiptFileNameFormat,
  serializeReceiptFileNameFormat,
} from './receiptFileName';

// Fake data only (CLAUDE.md §6): "Ana Prueba Ejemplo" is not a real person.
const ANA = 'Ana Prueba Ejemplo';

describe('buildReceiptFileName', () => {
  describe('the four formats', () => {
    it.each([
      ['name-month-year', 'AnaPruebaEjemplo-NominaOctubre2026'],
      ['name-year-month', 'AnaPruebaEjemplo-Nomina-2026-10'],
      ['year-month-name', '2026-10-Nomina-AnaPruebaEjemplo'],
      ['month-year', 'Nomina-Octubre2026'],
    ] as const)('builds %s for October 2026', (format, expected) => {
      expect(buildReceiptFileName(format, ANA, 2026, 10)).toBe(expected);
    });

    it('zero-pads the numeric month and writes the Spanish month name capitalised for March 2027', () => {
      expect(buildReceiptFileName('name-month-year', ANA, 2027, 3)).toBe(
        'AnaPruebaEjemplo-NominaMarzo2027',
      );
      expect(buildReceiptFileName('name-year-month', ANA, 2027, 3)).toBe(
        'AnaPruebaEjemplo-Nomina-2027-03',
      );
    });

    it('never writes an accent in a month name', () => {
      expect(buildReceiptFileName('month-year', ANA, 2026, 9)).toBe('Nomina-Septiembre2026');
      expect(buildReceiptFileName('month-year', ANA, 2026, 12)).toBe('Nomina-Diciembre2026');
    });

    it('leaves the employee name out of month-year, whatever the name is', () => {
      expect(buildReceiptFileName('month-year', ANA, 2026, 10)).toBe('Nomina-Octubre2026');
      expect(buildReceiptFileName('month-year', 'Otra Persona Distinta', 2026, 10)).toBe(
        'Nomina-Octubre2026',
      );
    });
  });

  describe('unusable period', () => {
    it.each([
      ['month 0', 2026, 0],
      ['month 13', 2026, 13],
      ['a fractional month', 2026, 2.5],
      ['a NaN month', 2026, Number.NaN],
      ['a fractional year', 2026.5, 10],
      ['a year below 1000', 999, 10],
      ['a year above 9999', 10000, 10],
      ['a NaN year', Number.NaN, 10],
    ])('returns null for %s', (_label, year, month) => {
      expect(buildReceiptFileName('name-month-year', ANA, year, month)).toBeNull();
      expect(buildReceiptFileName('month-year', ANA, year, month)).toBeNull();
    });

    it('accepts the year range boundaries', () => {
      expect(buildReceiptFileName('month-year', ANA, 1000, 1)).toBe('Nomina-Enero1000');
      expect(buildReceiptFileName('month-year', ANA, 9999, 12)).toBe('Nomina-Diciembre9999');
    });
  });

  describe('name part: transliteration, casing and separators', () => {
    it.each([
      ['Ñandú Peña', 'NanduPena'],
      ['Núñez Ibáñez', 'NunezIbanez'],
      ['Çelik Güell', 'CelikGuell'],
      ['ÁÉÍÓÚ Üa', 'AeiouUa'],
      ['Søren Æther Œuvre Straße', 'SorenAetherOeuvreStrasse'],
      ['María José de la Cruz', 'MariaJoseDeLaCruz'],
      ['Pérez-Reverte', 'PerezReverte'],
      ["O'Brien", 'OBrien'],
      ['O’Brien', 'OBrien'],
      ['ANA   PRUEBA', 'AnaPrueba'],
      ['  ana\tprueba  ', 'AnaPrueba'],
      ['Ana M. Prueba', 'AnaMPrueba'],
      ['Ana2 Prueba', 'Ana2Prueba'],
    ])('turns %j into %s', (name, expected) => {
      expect(buildReceiptFileName('name-month-year', name, 2026, 10)).toBe(
        `${expected}-NominaOctubre2026`,
      );
    });

    it.each([['year-month-name'], ['name-year-month']] as const)(
      'uses the same name part in %s',
      (format) => {
        expect(buildReceiptFileName(format, 'Ñandú Peña', 2026, 10)).toContain('NanduPena');
      },
    );
  });

  describe('name part: length cap', () => {
    it('cuts at a word boundary instead of inside a word (34 characters, not 43)', () => {
      expect(
        buildReceiptFileName(
          'name-month-year',
          'Maria Del Carmen Fernandez De Los Santos Rodriguez Gutierrez',
          2026,
          10,
        ),
      ).toBe('MariaDelCarmenFernandezDeLosSantos-NominaOctubre2026');
    });

    it('keeps a name of exactly 40 characters whole', () => {
      const name = `${'A'.repeat(20)} ${'B'.repeat(20)}`;
      expect(buildReceiptFileName('name-month-year', name, 2026, 10)).toBe(
        `A${'a'.repeat(19)}B${'b'.repeat(19)}-NominaOctubre2026`,
      );
    });

    it('stops at the first word that does not fit instead of skipping to a shorter later one', () => {
      const name = `${'A'.repeat(30)} ${'B'.repeat(20)} Cc`;
      expect(buildReceiptFileName('name-month-year', name, 2026, 10)).toBe(
        `A${'a'.repeat(29)}-NominaOctubre2026`,
      );
    });

    it('hard-cuts a single word longer than 40 characters', () => {
      expect(buildReceiptFileName('name-month-year', 'A'.repeat(60), 2026, 10)).toBe(
        `A${'a'.repeat(39)}-NominaOctubre2026`,
      );
    });
  });

  describe('name part: fallback', () => {
    it.each([
      ['an empty name', ''],
      ['whitespace only', '   '],
      ['separators only', "-'.,"],
      ['a character with no ASCII mapping', '李'],
      ['an emoji', '\u{1F600}'],
    ])('uses Empleado for %s', (_label, name) => {
      expect(buildReceiptFileName('name-month-year', name, 2026, 10)).toBe(
        'Empleado-NominaOctubre2026',
      );
      expect(buildReceiptFileName('year-month-name', name, 2026, 10)).toBe(
        '2026-10-Nomina-Empleado',
      );
    });
  });
});

describe('RECEIPT_FILE_NAME_FORMAT_IDS', () => {
  it('lists the four formats in selector order', () => {
    expect(RECEIPT_FILE_NAME_FORMAT_IDS).toEqual([
      'name-month-year',
      'name-year-month',
      'year-month-name',
      'month-year',
    ]);
  });
});

describe('RECEIPT_FILE_NAME_FORMAT_EXAMPLES', () => {
  it('shows one generated example file name per format, built with a placeholder name', () => {
    expect(RECEIPT_FILE_NAME_FORMAT_EXAMPLES).toEqual({
      'name-month-year': 'NombreApellido-NominaOctubre2026.pdf',
      'name-year-month': 'NombreApellido-Nomina-2026-10.pdf',
      'year-month-name': '2026-10-Nomina-NombreApellido.pdf',
      'month-year': 'Nomina-Octubre2026.pdf',
    });
  });

  it('matches what the builder produces, so the label can never drift from the behaviour', () => {
    for (const id of RECEIPT_FILE_NAME_FORMAT_IDS) {
      expect(RECEIPT_FILE_NAME_FORMAT_EXAMPLES[id]).toBe(
        `${buildReceiptFileName(id, 'Nombre Apellido', 2026, 10)}.pdf`,
      );
    }
  });
});

describe('resolveReceiptFileNameFormat', () => {
  it.each([
    ['an employee format over a global one', 'year-month-name', 'month-year', 'year-month-name'],
    ['auto over a global format (random name)', 'auto', 'month-year', null],
    ['inherit with a global format', null, 'month-year', 'month-year'],
    ['inherit with nothing global', null, null, null],
    ['auto with nothing global', 'auto', null, null],
  ] as const)('resolves %s', (_label, employee, global, expected) => {
    expect(resolveReceiptFileNameFormat(employee, global)).toBe(expected);
  });

  it.each([['bogus'], [''], [42], [undefined]])(
    'treats the unknown employee value %j as inherit',
    (garbage) => {
      expect(resolveReceiptFileNameFormat(garbage as never, 'name-year-month')).toBe(
        'name-year-month',
      );
      expect(resolveReceiptFileNameFormat(garbage as never, null)).toBeNull();
    },
  );

  it.each([['bogus'], ['auto'], [''], [42], [{}]])(
    'treats the unknown global value %j as unset',
    (garbage) => {
      expect(resolveReceiptFileNameFormat(null, garbage as never)).toBeNull();
      expect(resolveReceiptFileNameFormat('month-year', garbage as never)).toBe('month-year');
    },
  );

  it('does not mistake inherited object keys for formats', () => {
    expect(resolveReceiptFileNameFormat('constructor' as never, null)).toBeNull();
    expect(resolveReceiptFileNameFormat(null, 'toString' as never)).toBeNull();
  });
});

describe('isSafeReceiptFileName', () => {
  it('accepts every name the builder can produce', () => {
    const names = ['Ñandú Peña', 'Pérez-Reverte', '李', '', 'A'.repeat(80), ANA];
    for (const format of RECEIPT_FILE_NAME_FORMAT_IDS) {
      for (const name of names) {
        const built = buildReceiptFileName(format, name, 2026, 10);
        expect(built).not.toBeNull();
        expect(isSafeReceiptFileName(built as string)).toBe(true);
      }
    }
  });

  it.each([
    ['Nomina-Octubre2026'],
    ['Empleado'],
    ['2026-10-Nomina-AnaPruebaEjemplo'],
    ['a'],
    ['A'.repeat(100)],
  ])('accepts %s', (candidate) => {
    expect(isSafeReceiptFileName(candidate)).toBe(true);
  });

  it.each([
    ['an empty string', ''],
    ['a parent-directory name', '../x'],
    ['a dot', '.'],
    ['a dot-dot', '..'],
    ['a forward slash', 'a/b'],
    ['a backslash', 'a\\b'],
    ['a space', 'a b'],
    ['a non-ASCII letter', 'ñ'],
    ['a percent sign', 'a%20b'],
    ['a leading dot', '.hidden'],
    ['an inner dot (no extension allowed, the adapter adds .pdf)', 'a.b'],
    ['a double dot inside', 'a..b'],
    ['a leading hyphen', '-abc'],
    ['101 characters', 'A'.repeat(101)],
    ['a trailing newline', 'abc\n'],
  ])('rejects %s', (_label, candidate) => {
    expect(isSafeReceiptFileName(candidate)).toBe(false);
  });
});

describe('receipt file name format codec', () => {
  it('stores the format under a fixed settings key', () => {
    expect(RECEIPT_FILE_NAME_FORMAT_KEY).toBe('receipt.fileNameFormat');
  });

  describe('parseReceiptFileNameFormat (lenient)', () => {
    it.each(RECEIPT_FILE_NAME_FORMAT_IDS)('reads the stored id %s', (id) => {
      expect(parseReceiptFileNameFormat(id)).toBe(id);
    });

    it.each([
      ['no row', null],
      ['the unset marker', ''],
      ['an unknown id', 'bogus'],
      ['auto, which is employee-only', 'auto'],
      ['a padded id', ' month-year'],
      ['garbage that looks like JSON', '{"id":"month-year"}'],
      ['a non-string value', 42],
      ['an inherited object key', 'constructor'],
    ])('reads %s as unset', (_label, raw) => {
      expect(parseReceiptFileNameFormat(raw as never)).toBeNull();
    });
  });

  describe('serializeReceiptFileNameFormat (strict)', () => {
    it('writes the unset marker for null, because the settings table cannot hold NULL or delete a row', () => {
      expect(serializeReceiptFileNameFormat(null)).toBe('');
    });

    it.each(RECEIPT_FILE_NAME_FORMAT_IDS)('writes %s as itself', (id) => {
      expect(serializeReceiptFileNameFormat(id)).toBe(id);
    });

    it.each([['auto'], ['bogus'], [''], [42]])('throws a fixed RangeError for %j', (value) => {
      expect(() => serializeReceiptFileNameFormat(value as never)).toThrow(RangeError);
      expect(() => serializeReceiptFileNameFormat(value as never)).toThrow(
        'Invalid receipt file name format',
      );
    });

    it('round-trips every format and the unset state through parse', () => {
      for (const id of RECEIPT_FILE_NAME_FORMAT_IDS) {
        expect(parseReceiptFileNameFormat(serializeReceiptFileNameFormat(id))).toBe(id);
      }
      expect(parseReceiptFileNameFormat(serializeReceiptFileNameFormat(null))).toBeNull();
    });
  });

  describe('readReceiptFileNameFormat (total)', () => {
    it('returns the stored id', async () => {
      const settings = new InMemorySettingsRepository();
      await settings.set(RECEIPT_FILE_NAME_FORMAT_KEY, 'month-year');

      await expect(readReceiptFileNameFormat(settings)).resolves.toBe('month-year');
    });

    it('returns null when no row exists', async () => {
      await expect(readReceiptFileNameFormat(new InMemorySettingsRepository())).resolves.toBeNull();
    });

    it('returns null for a corrupt stored value', async () => {
      const settings = new InMemorySettingsRepository();
      await settings.set(RECEIPT_FILE_NAME_FORMAT_KEY, 'not-a-format');

      await expect(readReceiptFileNameFormat(settings)).resolves.toBeNull();
    });

    it('returns null when the repository rejects, instead of propagating', async () => {
      const throwing: SettingsRepository = {
        get: () => Promise.reject(new Error('I/O error')),
        set: () => Promise.reject(new Error('unused')),
      };

      await expect(readReceiptFileNameFormat(throwing)).resolves.toBeNull();
    });

    it('returns null when the repository throws synchronously', async () => {
      const throwing: SettingsRepository = {
        get: () => {
          throw new Error('synchronous I/O error');
        },
        set: () => Promise.reject(new Error('unused')),
      };

      await expect(readReceiptFileNameFormat(throwing)).resolves.toBeNull();
    });
  });
});
