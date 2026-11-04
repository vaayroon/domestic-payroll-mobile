import { en } from './locales/en';
import { es } from './locales/es';

type Tree = { readonly [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'string') {
      out.set(path, value);
    } else {
      for (const [childPath, childValue] of flatten(value, path)) {
        out.set(childPath, childValue);
      }
    }
  }
  return out;
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([^}\s,]+)[^}]*\}\}/g)].map((m) => m[1] ?? '').sort();
}

const esFlat = flatten(es);
const enFlat = flatten(en);

describe('i18n catalog parity (es <-> en)', () => {
  it('has identical key sets', () => {
    const onlyEs = [...esFlat.keys()].filter((k) => !enFlat.has(k));
    const onlyEn = [...enFlat.keys()].filter((k) => !esFlat.has(k));
    expect({ onlyEs, onlyEn }).toEqual({ onlyEs: [], onlyEn: [] });
  });

  it('has no empty values', () => {
    const empty = [
      ...[...esFlat].filter(([, v]) => v.trim() === '').map(([k]) => `es:${k}`),
      ...[...enFlat].filter(([, v]) => v.trim() === '').map(([k]) => `en:${k}`),
    ];
    expect(empty).toEqual([]);
  });

  it('uses the same interpolation variables per key', () => {
    const mismatched = [...esFlat.keys()]
      .filter((k) => enFlat.has(k))
      .filter((k) => placeholders(esFlat.get(k) ?? '').join() !== placeholders(enFlat.get(k) ?? '').join());
    expect(mismatched).toEqual([]);
  });
});
