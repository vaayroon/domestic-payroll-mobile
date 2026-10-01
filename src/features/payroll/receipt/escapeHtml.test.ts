/**
 * Unit tests for `escapeHtml`. The ampersand-ordering case is the one that
 * actually bites: escaping `&` after the others double-escapes their output.
 */

import { escapeHtml } from './escapeHtml';

describe('escapeHtml', () => {
  it('leaves ordinary receipt values untouched', () => {
    expect(escapeHtml('Calle Falsa 123')).toBe('Calle Falsa 123');
    expect(escapeHtml('1.221,00 €')).toBe('1.221,00 €');
    expect(escapeHtml('')).toBe('');
  });

  it('escapes each of the five characters', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('does not double-escape the ampersands it introduces', () => {
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('a & b < c')).toBe('a &amp; b &lt; c');
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });

  it('handles a realistic address containing an ampersand', () => {
    expect(escapeHtml('Calle Pérez & Hijos, 4')).toBe('Calle Pérez &amp; Hijos, 4');
  });

  it('closes a double-quoted attribute value', () => {
    expect(escapeHtml('" onerror="x')).toBe('&quot; onerror=&quot;x');
  });
});
