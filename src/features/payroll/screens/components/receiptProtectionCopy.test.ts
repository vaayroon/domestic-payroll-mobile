/**
 * Copy guard for password-protected receipts (spec R5). The protection only
 * prevents ACCIDENTAL opening (an NIF/NIE is not a secret), so no string the
 * user can read about it may promise security.
 */

import {
  RECEIPT_ENCRYPTION_FAILED_ERROR,
  RECEIPT_ENCRYPTION_UNAVAILABLE_ERROR,
} from '../../domain';
import * as protectionCopy from './receiptProtectionCopy';

const FORBIDDEN = /seguro|segura|seguridad|confidencial|imposible de abrir|inviolable/i;

describe('receiptProtectionCopy', () => {
  it('exposes the banner copy', () => {
    expect(protectionCopy.PROTECTED_RECEIPT_SUCCESS_COPY).toBe('Recibo generado y protegido con contraseña.');
    expect(protectionCopy.PROTECTED_RECEIPT_HINT_COPY).toBe(
      'Recuerda indicar al empleado cómo abrir el recibo protegido.',
    );
    expect(protectionCopy.ENCRYPT_RECEIPT_ACTION_LABEL).toBe('Cifrar');
  });

  it('never overclaims security in any exported string or generation error', () => {
    const strings: string[] = [
      ...Object.values(protectionCopy),
      RECEIPT_ENCRYPTION_UNAVAILABLE_ERROR,
      RECEIPT_ENCRYPTION_FAILED_ERROR,
    ];

    expect(strings.length).toBeGreaterThanOrEqual(5);
    for (const copy of strings) {
      expect(copy).not.toMatch(FORBIDDEN);
    }
  });
});
