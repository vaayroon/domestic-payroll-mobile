/**
 * Dev-only seed loader — prefers the git-ignored `seed.local.ts` (real data,
 * edited in place by the developer) and falls back to the committed
 * `seed.example.ts` (fake placeholders) if the local file's content was ever
 * reset back to its own fake defaults. Always returns `null` outside
 * `__DEV__`, so a production build never seeds anything
 * (`sdd/foundation/spec` "Git-ignored, dev-gated local seed" requirement).
 *
 * NOT wired into the app's boot sequence yet — that belongs to Phase 4's
 * smoke screen / dev bootstrap, which is the first consumer that actually
 * needs seeded data to demonstrate the DB round-trip.
 */

import { DEV_SEED as EXAMPLE_SEED } from './seed.example';
import { DEV_SEED as LOCAL_SEED } from './seed.local';
import type { DevSeed } from './seedTypes';

export function loadDevSeed(): DevSeed | null {
  if (!__DEV__) {
    return null;
  }
  return LOCAL_SEED ?? EXAMPLE_SEED;
}
