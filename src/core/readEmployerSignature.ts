/**
 * Read-side boundary for the employer's saved signature (design ADR-3/ADR-6).
 *
 * TOTAL function: never rejects, never throws. Any settings-read failure or
 * invalid stored value degrades to `null` -- a missing signature must NEVER
 * block receipt generation. Nothing is logged: the caught value could in
 * principle carry the payload (CLAUDE.md §6).
 */

import { EMPLOYER_SIGNATURE_KEY, parseEmployerSignature } from './employerSignature';
import type { SettingsRepository } from '@/types';

export async function readEmployerSignature(settings: SettingsRepository): Promise<string | null> {
  try {
    return parseEmployerSignature(await settings.get(EMPLOYER_SIGNATURE_KEY)).pngBase64;
  } catch {
    return null;
  }
}
