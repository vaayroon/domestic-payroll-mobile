import { EMPLOYER_SIGNATURE_KEY, serializeEmployerSignature } from './employerSignature';
import { readEmployerSignature } from './readEmployerSignature';
import { InMemorySettingsRepository } from './testing/fakes';
import { SYNTHETIC_SIGNATURE_PNG_BASE64 } from './testing/fixtures';
import type { SettingsRepository } from '@/types';

describe('readEmployerSignature', () => {
  it('returns the stored payload when a valid signature is saved', async () => {
    const settings = new InMemorySettingsRepository();
    await settings.set(
      EMPLOYER_SIGNATURE_KEY,
      serializeEmployerSignature({ pngBase64: SYNTHETIC_SIGNATURE_PNG_BASE64, updatedAt: 1 }),
    );

    await expect(readEmployerSignature(settings)).resolves.toBe(SYNTHETIC_SIGNATURE_PNG_BASE64);
  });

  it('resolves null when no signature is stored', async () => {
    const settings = new InMemorySettingsRepository();

    await expect(readEmployerSignature(settings)).resolves.toBeNull();
  });

  it('resolves null when the stored value is corrupt', async () => {
    const settings = new InMemorySettingsRepository();
    await settings.set(EMPLOYER_SIGNATURE_KEY, '{not valid json');

    await expect(readEmployerSignature(settings)).resolves.toBeNull();
  });

  it('resolves null when SettingsRepository.get rejects (never rejects itself)', async () => {
    const throwingSettings: SettingsRepository = {
      get: () => Promise.reject(new Error('I/O error')),
      set: () => Promise.reject(new Error('unused')),
    };

    await expect(readEmployerSignature(throwingSettings)).resolves.toBeNull();
  });

  it('resolves null when SettingsRepository.get throws synchronously (never rejects itself)', async () => {
    const throwingSettings: SettingsRepository = {
      get: () => {
        throw new Error('synchronous I/O error');
      },
      set: () => Promise.reject(new Error('unused')),
    };

    await expect(readEmployerSignature(throwingSettings)).resolves.toBeNull();
  });
});
