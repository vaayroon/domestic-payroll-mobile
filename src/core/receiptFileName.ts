/**
 * Pure rules for the readable file name of a receipt PDF. Without a configured
 * format the file keeps the random name `expo-print` picks; with one, the hook
 * builds a base name here and the PDF adapter places the file under it.
 *
 * The base name is ASCII only, on purpose. `isReceiptPdfUri` rejects any `%`,
 * and Android's `Uri.fromFile` percent-encodes every non-ASCII character, so a
 * name such as `Peña` would produce a uri the in-app viewer refuses to open.
 * Accents are therefore mapped by a static table (no `String.prototype.normalize`,
 * whose behaviour depends on the JS engine's ICU data) and anything that is not
 * `[A-Za-z0-9]` is dropped from the name part.
 *
 * No I/O, no clock: the period comes from the payroll run, never from "today".
 */

import type {
  EmployeeReceiptFileNameFormat,
  ReceiptFileNameFormatId,
  SettingsRepository,
} from '@/types';

import { MONTH_NAMES } from './monthNames';

/** Maximum length of the employee-name part, cut on a word boundary. */
export const RECEIPT_FILE_NAME_MAX_NAME_LENGTH = 40;

/** Used when nothing usable is left of the employee name. */
const FALLBACK_NAME_PART = 'Empleado';

const FIRST_YEAR = 1000;
const LAST_YEAR = 9999;

/** Formats in the order the selectors list them. */
export const RECEIPT_FILE_NAME_FORMAT_IDS: readonly ReceiptFileNameFormatId[] = [
  'name-month-year',
  'name-year-month',
  'year-month-name',
  'month-year',
];

/** Letters that have an ASCII reading, upper and lower case. Anything else non-ASCII is dropped. */
const TRANSLITERATION: Readonly<Record<string, string>> = {
  á: 'a',
  à: 'a',
  â: 'a',
  ä: 'a',
  ã: 'a',
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  í: 'i',
  ì: 'i',
  î: 'i',
  ï: 'i',
  ó: 'o',
  ò: 'o',
  ô: 'o',
  ö: 'o',
  õ: 'o',
  ú: 'u',
  ù: 'u',
  û: 'u',
  ü: 'u',
  ñ: 'n',
  ç: 'c',
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  ß: 'ss',
  Á: 'A',
  À: 'A',
  Â: 'A',
  Ä: 'A',
  Ã: 'A',
  É: 'E',
  È: 'E',
  Ê: 'E',
  Ë: 'E',
  Í: 'I',
  Ì: 'I',
  Î: 'I',
  Ï: 'I',
  Ó: 'O',
  Ò: 'O',
  Ô: 'O',
  Ö: 'O',
  Õ: 'O',
  Ú: 'U',
  Ù: 'U',
  Û: 'U',
  Ü: 'U',
  Ñ: 'N',
  Ç: 'C',
  Ø: 'O',
  Æ: 'AE',
  Œ: 'OE',
  ẞ: 'SS',
};

/** Word separators in a personal name: whitespace, hyphen, both apostrophes, dot, middle dot and comma. */
const WORD_SEPARATORS = /[\s\-'’.·,]+/;

const NON_ALPHANUMERIC = /[^A-Za-z0-9]/g;

function transliterate(text: string): string {
  let ascii = '';
  for (const character of text) {
    ascii += TRANSLITERATION[character] ?? character;
  }
  return ascii;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Turns a personal name into a PascalCase ASCII part of at most
 * `RECEIPT_FILE_NAME_MAX_NAME_LENGTH` characters. Words are kept in typed order
 * (particles included) and the cut never lands inside a word; only a first word
 * that is itself too long is sliced. `Empleado` when nothing survives.
 */
function toFileNameWord(name: string): string {
  const words = transliterate(name)
    .split(WORD_SEPARATORS)
    .map((word) => capitalize(word.replace(NON_ALPHANUMERIC, '')))
    .filter((word) => word !== '');

  let part = '';
  for (const word of words) {
    if (part.length + word.length > RECEIPT_FILE_NAME_MAX_NAME_LENGTH) {
      break;
    }
    part += word;
  }
  const [firstWord] = words;
  if (part === '' && firstWord !== undefined) {
    part = firstWord.slice(0, RECEIPT_FILE_NAME_MAX_NAME_LENGTH);
  }
  return part === '' ? FALLBACK_NAME_PART : part;
}

/** Assembles a base name from an already validated period. */
function composeFileName(
  format: ReceiptFileNameFormatId,
  namePart: string,
  year: number,
  month: number,
): string {
  const numericMonth = String(month).padStart(2, '0');
  // The month is already validated (1-12) by every caller, so the lookup always hits.
  const monthName = capitalize(MONTH_NAMES[month - 1] ?? '');
  switch (format) {
    case 'name-month-year':
      return `${namePart}-Nomina${monthName}${year}`;
    case 'name-year-month':
      return `${namePart}-Nomina-${year}-${numericMonth}`;
    case 'year-month-name':
      return `${year}-${numericMonth}-Nomina-${namePart}`;
    case 'month-year':
      return `Nomina-${monthName}${year}`;
  }
}

/**
 * Builds the base name (no extension) of a receipt file, or `null` when the
 * period is unusable: a month outside 1-12 or a year outside 1000-9999, or a
 * non-integer in either. Total: it never throws, so a bad period degrades to
 * the random name instead of failing a receipt.
 */
export function buildReceiptFileName(
  format: ReceiptFileNameFormatId,
  employeeName: string,
  periodYear: number,
  periodMonth: number,
): string | null {
  const validMonth = Number.isInteger(periodMonth) && periodMonth >= 1 && periodMonth <= 12;
  const validYear =
    Number.isInteger(periodYear) && periodYear >= FIRST_YEAR && periodYear <= LAST_YEAR;
  if (!validMonth || !validYear) {
    return null;
  }
  return composeFileName(format, toFileNameWord(employeeName), periodYear, periodMonth);
}

function isFormatId(value: unknown): value is ReceiptFileNameFormatId {
  return RECEIPT_FILE_NAME_FORMAT_IDS.some((id) => id === value);
}

/**
 * Decides which format names a receipt: the employee's own choice wins, `auto`
 * forces the random name even when a general format exists, and `null` inherits
 * the general one. `null` result = keep the random name.
 *
 * Total on purpose: stored values can be stale or corrupt, so anything that is
 * not a known id counts as "inherit" for the employee and as "unset" for the
 * general value (which can never be `auto`).
 */
export function resolveReceiptFileNameFormat(
  employee: EmployeeReceiptFileNameFormat | null,
  global: ReceiptFileNameFormatId | null,
): ReceiptFileNameFormatId | null {
  if (employee === 'auto') {
    return null;
  }
  if (isFormatId(employee)) {
    return employee;
  }
  return isFormatId(global) ? global : null;
}

/** First character alphanumeric (so never a leading `-`), then alphanumerics and hyphens, 100 characters at most. */
const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/;

/**
 * Guard the PDF adapter applies to a base name before touching the file
 * system. There is no dot, so no `..`, no extension and no separator; every
 * accepted character survives `Uri.fromFile` without a `%`, which keeps the
 * resulting uri valid for `isReceiptPdfUri`. An unsafe name is never an error:
 * the caller falls back to the random name.
 */
export function isSafeReceiptFileName(candidate: string): boolean {
  return SAFE_FILE_NAME.test(candidate);
}

/**
 * One example file name per format, built by the real builder with a
 * placeholder name. Both selectors use these as the option labels, so the copy
 * can never drift from what the builder does and `core/` needs no Spanish copy
 * of its own.
 */
export const RECEIPT_FILE_NAME_FORMAT_EXAMPLES: Readonly<Record<ReceiptFileNameFormatId, string>> =
  {
    'name-month-year': `${composeFileName('name-month-year', 'NombreApellido', 2026, 10)}.pdf`,
    'name-year-month': `${composeFileName('name-year-month', 'NombreApellido', 2026, 10)}.pdf`,
    'year-month-name': `${composeFileName('year-month-name', 'NombreApellido', 2026, 10)}.pdf`,
    'month-year': `${composeFileName('month-year', 'NombreApellido', 2026, 10)}.pdf`,
  };

/** `app_settings` key of the general format. */
export const RECEIPT_FILE_NAME_FORMAT_KEY = 'receipt.fileNameFormat';

/** Stored when no general format is set: `app_settings.value` is NOT NULL and the repository cannot delete a row. */
const UNSET_MARKER = '';

const INVALID_FORMAT_MESSAGE = 'Invalid receipt file name format';

/**
 * Reads a raw `SettingsRepository.get()` value. Lenient: absent, empty or
 * anything that is not exactly a known id (including `auto`, which only an
 * employee may hold) reads as unset, never as an error.
 */
export function parseReceiptFileNameFormat(raw: string | null): ReceiptFileNameFormatId | null {
  return isFormatId(raw) ? raw : null;
}

/**
 * Writes the general format as a plain string (the id, or the unset marker for
 * `null`). Strict, unlike `parse`: only the screen calls it, with a closed set
 * of options, so anything else is a programming error. The message is fixed.
 */
export function serializeReceiptFileNameFormat(format: ReceiptFileNameFormatId | null): string {
  if (format === null) {
    return UNSET_MARKER;
  }
  if (!isFormatId(format)) {
    throw new RangeError(INVALID_FORMAT_MESSAGE);
  }
  return format;
}

/**
 * Read-side boundary for the general format. TOTAL: a settings failure
 * degrades to `null` (random name), because a missing name must never block a
 * receipt. Nothing is logged.
 */
export async function readReceiptFileNameFormat(
  settings: SettingsRepository,
): Promise<ReceiptFileNameFormatId | null> {
  try {
    return parseReceiptFileNameFormat(await settings.get(RECEIPT_FILE_NAME_FORMAT_KEY));
  } catch {
    return null;
  }
}
