/**
 * Render test for `useReceiptFileNameSetting` (receipt-file-name design D3):
 * `select` only stages a choice, `submit` persists it. Same provider-injection
 * pattern as `useEmployerSignature.test.tsx`, with the shared
 * `InMemorySettingsRepository`.
 */

import { act, create } from 'react-test-renderer';

import { RECEIPT_FILE_NAME_FORMAT_KEY, readReceiptFileNameFormat } from '@/core/receiptFileName';
import { RepositoryProvider, type Repositories } from '@/core/RepositoryProvider';
import { InMemorySettingsRepository } from '@/core/testing/fakes';
import type {
  EmployeeRepository,
  EmployerRepository,
  PayrollRunRepository,
  SettingsRepository,
} from '@/types';

import {
  useReceiptFileNameSetting,
  type UseReceiptFileNameSettingResult,
} from './useReceiptFileNameSetting';

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

function HookHarness({
  onResult,
}: {
  onResult: (result: UseReceiptFileNameSettingResult) => void;
}) {
  const result = useReceiptFileNameSetting();
  onResult(result);
  return null;
}

async function renderUseReceiptFileNameSetting(settings: SettingsRepository) {
  const repositories: Repositories = {
    employers: fakeEmployerRepository,
    employees: fakeEmployeeRepository,
    payrollRuns: fakePayrollRunRepository,
    settings,
  };

  let latest!: UseReceiptFileNameSettingResult;

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
    get current(): UseReceiptFileNameSettingResult {
      return latest;
    },
  };
}

describe('useReceiptFileNameSetting', () => {
  describe('loading', () => {
    it('loads as unset when nothing is persisted', async () => {
      const harness = await renderUseReceiptFileNameSetting(new InMemorySettingsRepository());

      expect(harness.current.loading).toBe(false);
      expect(harness.current.value).toBeNull();
      expect(harness.current.saveError).toBeNull();
    });

    it('loads a persisted format', async () => {
      const settings = new InMemorySettingsRepository();
      await settings.set(RECEIPT_FILE_NAME_FORMAT_KEY, 'year-month-name');

      const harness = await renderUseReceiptFileNameSetting(settings);

      expect(harness.current.loading).toBe(false);
      expect(harness.current.value).toBe('year-month-name');
    });

    it.each([['bogus'], ['auto'], ['']])('loads the stored value %j as unset', async (stored) => {
      const settings = new InMemorySettingsRepository();
      await settings.set(RECEIPT_FILE_NAME_FORMAT_KEY, stored);

      const harness = await renderUseReceiptFileNameSetting(settings);

      expect(harness.current.value).toBeNull();
    });

    it('degrades to unset, without rejecting, when the settings read fails', async () => {
      const throwing: SettingsRepository = {
        get: () => Promise.reject(new Error('I/O error')),
        set: () => Promise.reject(new Error('unused')),
      };

      const harness = await renderUseReceiptFileNameSetting(throwing);

      expect(harness.current.loading).toBe(false);
      expect(harness.current.value).toBeNull();
    });
  });

  describe('select and submit (design D3)', () => {
    it('stages a selection without persisting it', async () => {
      const settings = new InMemorySettingsRepository();
      const harness = await renderUseReceiptFileNameSetting(settings);

      await act(async () => {
        harness.current.select('month-year');
      });

      expect(harness.current.value).toBe('month-year');
      await expect(readReceiptFileNameFormat(settings)).resolves.toBeNull();
    });

    it('persists the staged format on submit and reports success', async () => {
      const settings = new InMemorySettingsRepository();
      const harness = await renderUseReceiptFileNameSetting(settings);

      await act(async () => {
        harness.current.select('month-year');
      });
      let saved: boolean | null = null;
      await act(async () => {
        saved = await harness.current.submit();
      });

      expect(saved).toBe(true);
      await expect(readReceiptFileNameFormat(settings)).resolves.toBe('month-year');
      expect(harness.current.saving).toBe(false);
      expect(harness.current.saveError).toBeNull();
    });

    it('clears the stored format when the default is staged and submitted', async () => {
      const settings = new InMemorySettingsRepository();
      await settings.set(RECEIPT_FILE_NAME_FORMAT_KEY, 'name-month-year');
      const harness = await renderUseReceiptFileNameSetting(settings);

      await act(async () => {
        harness.current.select(null);
      });
      await act(async () => {
        await harness.current.submit();
      });

      await expect(readReceiptFileNameFormat(settings)).resolves.toBeNull();
      await expect(settings.get(RECEIPT_FILE_NAME_FORMAT_KEY)).resolves.toBe('');
    });

    it('keeps the last staged choice when selecting twice', async () => {
      const settings = new InMemorySettingsRepository();
      const harness = await renderUseReceiptFileNameSetting(settings);

      await act(async () => {
        harness.current.select('month-year');
      });
      await act(async () => {
        harness.current.select('name-year-month');
      });
      await act(async () => {
        await harness.current.submit();
      });

      await expect(readReceiptFileNameFormat(settings)).resolves.toBe('name-year-month');
    });

    it('reports saving while the write is in flight', async () => {
      let release: (() => void) | undefined;
      const slow: SettingsRepository = {
        get: async () => null,
        set: (key, value) =>
          new Promise((resolve) => {
            release = () => resolve({ key, value });
          }),
      };
      const harness = await renderUseReceiptFileNameSetting(slow);

      let pending!: Promise<boolean>;
      await act(async () => {
        pending = harness.current.submit();
      });
      expect(harness.current.saving).toBe(true);

      await act(async () => {
        release?.();
        await pending;
      });
      expect(harness.current.saving).toBe(false);
    });
  });

  describe('save failure', () => {
    it('returns false with a fixed Spanish error that never carries the cause', async () => {
      const failing: SettingsRepository = {
        get: async () => null,
        set: () => Promise.reject(new Error('disk exploded with secret-value')),
      };
      const harness = await renderUseReceiptFileNameSetting(failing);

      await act(async () => {
        harness.current.select('month-year');
      });
      let saved: boolean | null = null;
      await act(async () => {
        saved = await harness.current.submit();
      });

      expect(saved).toBe(false);
      expect(harness.current.saveError).toBe('save_failed');
      expect(harness.current.saving).toBe(false);
    });

    it('clears a previous error on the next successful submit', async () => {
      let fail = true;
      const flaky: SettingsRepository = {
        get: async () => null,
        set: async (key, value) => {
          if (fail) throw new Error('boom');
          return { key, value };
        },
      };
      const harness = await renderUseReceiptFileNameSetting(flaky);

      await act(async () => {
        await harness.current.submit();
      });
      expect(harness.current.saveError).toBe('save_failed');

      fail = false;
      await act(async () => {
        await harness.current.submit();
      });
      expect(harness.current.saveError).toBeNull();
    });
  });
});
