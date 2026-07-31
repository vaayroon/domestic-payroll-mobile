/**
 * Shared shape for `seed.example.ts` (committed, fake) and `seed.local.ts`
 * (git-ignored, real) — see `seedLoader.ts` for how the two are resolved.
 */

import type { NewEmployee, NewEmployer } from '@/types';

export interface DevSeed {
  readonly employer: NewEmployer;
  readonly employee: Omit<NewEmployee, 'employerId'>;
}
