/**
 * Escapes the characters that can break out of HTML text content or a
 * double-quoted attribute value.
 *
 * Every value `buildReceiptHtml` interpolates comes from data the user typed
 * into the app (names, NIF/NAF, address, CCC, the issuing place). None of it
 * is attacker-controlled -- this is a local-first, single-user app with no
 * network input path -- so the risk here is DOCUMENT CORRUPTION, not script
 * injection: an address containing `&` or a name containing `<` would emit
 * malformed markup and `expo-print` would render a broken receipt with no
 * warning.
 *
 * `&` MUST be replaced first; doing it later would double-escape the
 * ampersands introduced by the other replacements.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
