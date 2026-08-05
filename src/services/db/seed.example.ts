/**
 * Committed dev seed — OBVIOUSLY-FAKE placeholder data only. NO real PII may
 * ever land in this file (CLAUDE.md §6 / §5, `sdd/foundation/spec` "Fake-only
 * committed seed" requirement).
 *
 * This is the fallback `seedLoader.ts` uses when `seed.local.ts` hasn't been
 * given real values. It is also the safe default `seed.local.ts` starts from
 * (see that file's header comment for why it must physically exist on disk).
 */

import { fromEuros } from '@/types/money';

import type { DevSeed } from './seedTypes';

export const DEV_SEED: DevSeed = {
  employer: {
    name: 'Empleador Ejemplo',
    nif: '00000000T',
    address: 'Calle Falsa 123, 28080 Madrid',
    ccc: '28000000000',
  },
  employee: {
    name: 'Empleada Ejemplo',
    nif: '00000001T',
    naf: '281234567890',
    baseGrossCents: fromEuros(1200),
    active: true,
    altaDate: null,
    bajaDate: null,
  },
};
