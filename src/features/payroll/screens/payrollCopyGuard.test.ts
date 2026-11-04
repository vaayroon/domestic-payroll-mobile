/**
 * Copy guard for password-protected receipts (spec R5). The protection only
 * prevents ACCIDENTAL opening (an NIF/NIE is not a secret), so no string the
 * user can read about it may promise security, in either UI language.
 */

import { i18n } from '@/core/i18n';

const FORBIDDEN_ES = /seguro|segura|seguridad|confidencial|imposible de abrir|inviolable/i;
const FORBIDDEN_EN = /secure|security|confidential|impossible to open|tamper/i;

function protectedReceiptCopy(lng: 'es' | 'en'): string[] {
  const t = i18n.getFixedT(lng);
  return [
    t(($) => $.payroll.protection.generatedProtected),
    t(($) => $.payroll.protection.hint),
    t(($) => $.payroll.protection.viewerFailure),
    t(($) => $.payroll.history.encrypt),
    t(($) => $.payroll.generate.errors.encryption_unavailable),
    t(($) => $.payroll.generate.errors.encryption_failed),
  ];
}

describe('payroll protected-receipt copy', () => {
  it('exposes the Spanish banner copy', () => {
    const t = i18n.getFixedT('es');
    expect(t(($) => $.payroll.protection.generatedProtected)).toBe(
      'Recibo generado y protegido con contraseña.',
    );
    expect(t(($) => $.payroll.protection.hint)).toBe(
      'Recuerda indicar al empleado cómo abrir el recibo protegido.',
    );
    expect(t(($) => $.payroll.history.encrypt)).toBe('Cifrar');
  });

  it.each([
    ['es', FORBIDDEN_ES],
    ['en', FORBIDDEN_EN],
  ] as const)('never overclaims security in any %s string', (lng, forbidden) => {
    const strings = protectedReceiptCopy(lng);

    expect(strings.length).toBeGreaterThanOrEqual(5);
    for (const copy of strings) {
      expect(copy).not.toMatch(forbidden);
    }
  });
});
