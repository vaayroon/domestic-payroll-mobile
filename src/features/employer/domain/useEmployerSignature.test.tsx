/**
 * Render test for `useEmployerSignature` (design ADR-5/ADR-6): mirrors
 * `useReminderSettings.test.tsx`'s provider-injection pattern, using the
 * shared `InMemorySettingsRepository` fake through `RepositoryProvider`.
 */

import { act, create } from 'react-test-renderer';

import { InMemorySettingsRepository } from '@/core/testing/fakes';
import { SYNTHETIC_SIGNATURE_PNG_BASE64 } from '@/core/testing/fixtures';
import { RepositoryProvider, type Repositories } from '@/core/RepositoryProvider';
import { EMPLOYER_SIGNATURE_KEY, serializeEmployerSignature } from '@/core/employerSignature';
import type { EmployeeRepository, EmployerRepository, PayrollRunRepository, SettingsRepository } from '@/types';

import { useEmployerSignature, type UseEmployerSignatureResult } from './useEmployerSignature';

function notImplemented(method: string): () => never {
  return () => {
    throw new Error(`not implemented in this test fake: ${method}`);
  };
}

const fakeEmployerRepository: EmployerRepository = {
  list: notImplemented('EmployerRepository.list'),
  getById: notImplemented('EmployerRepository.getById'),
  create: notImplemented('EmployerRepository.create'),
  update: notImplemented('EmployerRepository.update'),
  remove: notImplemented('EmployerRepository.remove'),
};

const fakeEmployeeRepository: EmployeeRepository = {
  list: notImplemented('EmployeeRepository.list'),
  getById: notImplemented('EmployeeRepository.getById'),
  create: notImplemented('EmployeeRepository.create'),
  update: notImplemented('EmployeeRepository.update'),
  remove: notImplemented('EmployeeRepository.remove'),
};

const fakePayrollRunRepository: PayrollRunRepository = {
  listByEmployee: notImplemented('PayrollRunRepository.listByEmployee'),
  getByPeriod: notImplemented('PayrollRunRepository.getByPeriod'),
  create: notImplemented('PayrollRunRepository.create'),
  remove: notImplemented('PayrollRunRepository.remove'),
};

function HookHarness({ onResult }: { onResult: (result: UseEmployerSignatureResult) => void }) {
  const result = useEmployerSignature();
  onResult(result);
  return null;
}

async function renderUseEmployerSignature(settings: SettingsRepository) {
  const repositories: Repositories = {
    employers: fakeEmployerRepository,
    employees: fakeEmployeeRepository,
    payrollRuns: fakePayrollRunRepository,
    settings,
  };

  let latest!: UseEmployerSignatureResult;

  await act(async () => {
    create(
      <RepositoryProvider repositories={repositories}>
        <HookHarness onResult={(result) => (latest = result)} />
      </RepositoryProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    get current(): UseEmployerSignatureResult {
      return latest;
    },
  };
}

describe('useEmployerSignature', () => {
  it('loads with no saved signature when nothing is persisted', async () => {
    const harness = await renderUseEmployerSignature(new InMemorySettingsRepository());

    expect(harness.current.loading).toBe(false);
    expect(harness.current.savedPngBase64).toBeNull();
  });

  it('loads an existing saved signature', async () => {
    const settings = new InMemorySettingsRepository();
    await settings.set(
      EMPLOYER_SIGNATURE_KEY,
      serializeEmployerSignature({ pngBase64: SYNTHETIC_SIGNATURE_PNG_BASE64, updatedAt: 1 }),
    );

    const harness = await renderUseEmployerSignature(settings);

    expect(harness.current.savedPngBase64).toBe(SYNTHETIC_SIGNATURE_PNG_BASE64);
  });

  it('save persists a valid envelope and updates savedPngBase64', async () => {
    const settings = new InMemorySettingsRepository();
    const harness = await renderUseEmployerSignature(settings);

    let ok = false;
    await act(async () => {
      ok = await harness.current.save(SYNTHETIC_SIGNATURE_PNG_BASE64);
    });

    expect(ok).toBe(true);
    expect(harness.current.savedPngBase64).toBe(SYNTHETIC_SIGNATURE_PNG_BASE64);
    expect(harness.current.saveError).toBeNull();

    const raw = await settings.get(EMPLOYER_SIGNATURE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? '{}')).toMatchObject({ pngBase64: SYNTHETIC_SIGNATURE_PNG_BASE64 });
  });

  it('save of an invalid payload sets a fixed Spanish error and persists nothing', async () => {
    const settings = new InMemorySettingsRepository();
    const harness = await renderUseEmployerSignature(settings);

    let ok = true;
    await act(async () => {
      ok = await harness.current.save('not-valid-base64-!!!');
    });

    expect(ok).toBe(false);
    expect(harness.current.saveError).toBe('No se pudo guardar la firma.');
    expect(harness.current.savedPngBase64).toBeNull();
    await expect(settings.get(EMPLOYER_SIGNATURE_KEY)).resolves.toBeNull();
    // Privacy: the fixed error message never contains the payload (CLAUDE.md §6).
    expect(harness.current.saveError ?? '').not.toContain(SYNTHETIC_SIGNATURE_PNG_BASE64);
  });

  it('clear writes a { pngBase64: null } envelope', async () => {
    const settings = new InMemorySettingsRepository();
    await settings.set(
      EMPLOYER_SIGNATURE_KEY,
      serializeEmployerSignature({ pngBase64: SYNTHETIC_SIGNATURE_PNG_BASE64, updatedAt: 1 }),
    );
    const harness = await renderUseEmployerSignature(settings);

    let ok = false;
    await act(async () => {
      ok = await harness.current.clear();
    });

    expect(ok).toBe(true);
    expect(harness.current.savedPngBase64).toBeNull();

    const raw = await settings.get(EMPLOYER_SIGNATURE_KEY);
    expect(JSON.parse(raw ?? '{}')).toMatchObject({ pngBase64: null });
  });

  it('degrades to "no signature" when the initial settings read rejects', async () => {
    const throwingSettings: SettingsRepository = {
      get: () => Promise.reject(new Error('I/O error')),
      set: notImplemented('SettingsRepository.set'),
    };

    const harness = await renderUseEmployerSignature(throwingSettings);

    expect(harness.current.loading).toBe(false);
    expect(harness.current.savedPngBase64).toBeNull();
    // The read failure is handled, not surfaced -- the user can still draw one.
    expect(harness.current.saveError).toBeNull();
  });

  it('degrades to "no signature" when the initial settings read throws synchronously', async () => {
    const throwingSettings: SettingsRepository = {
      get: () => {
        throw new Error('synchronous I/O error');
      },
      set: notImplemented('SettingsRepository.set'),
    };

    const harness = await renderUseEmployerSignature(throwingSettings);

    expect(harness.current.loading).toBe(false);
    expect(harness.current.savedPngBase64).toBeNull();
    expect(harness.current.saveError).toBeNull();
  });
});
