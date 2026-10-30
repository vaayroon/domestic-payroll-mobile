/**
 * Render test for `ReceiptFileNameSettingsScreen` (receipt-file-name design
 * D2/D3): the default row plus one row per format, a staged selection that is
 * only persisted by "Guardar", and `router.back()` after a successful save.
 * Harness mirrors `EmployerSignatureScreen.test.tsx`.
 */

import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  RECEIPT_FILE_NAME_FORMAT_EXAMPLES,
  RECEIPT_FILE_NAME_FORMAT_IDS,
  RECEIPT_FILE_NAME_FORMAT_KEY,
  RepositoryProvider,
  type Repositories,
} from '@/core';
import { InMemorySettingsRepository } from '@/core/testing/fakes';
import type {
  EmployeeRepository,
  EmployerRepository,
  PayrollRunRepository,
  SettingsRepository,
} from '@/types';

import { ReceiptFileNameSettingsScreen } from './ReceiptFileNameSettingsScreen';

// `router.back()` needs a live navigation tree; the screen is rendered
// standalone here, so `useRouter` is mocked (same as `EmployerSettingsScreen.test.tsx`).
const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ back: mockRouterBack }),
}));

const HELPER_COPY =
  'El nombre del archivo es visible al compartirlo o enviarlo, aunque el recibo esté protegido con contraseña.';
const DEFAULT_LABEL = 'Nombre automático (aleatorio)';

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

async function renderScreen(settings: SettingsRepository): Promise<ReactTestRenderer> {
  const repositories: Repositories = {
    employers: fakeEmployerRepository,
    employees: fakeEmployeeRepository,
    payrollRuns: fakePayrollRunRepository,
    settings,
  };

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <RepositoryProvider repositories={repositories}>
        <ReceiptFileNameSettingsScreen />
      </RepositoryProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return renderer;
}

// `testID` is also a prop of the screen's own row component, so pick the
// element that carries the accessibility state (the Pressable).
function option(renderer: ReactTestRenderer, id: string) {
  const matches = renderer.root.findAllByProps({ testID: `receipt-file-name-option-${id}` });
  const pressable = matches.find((node) => node.props.accessibilityState !== undefined);
  if (pressable === undefined) {
    throw new Error(`option ${id} not found`);
  }
  return pressable;
}

function isSelected(renderer: ReactTestRenderer, id: string): boolean {
  return option(renderer, id).props.accessibilityState.checked === true;
}

function texts(renderer: ReactTestRenderer): unknown[] {
  return renderer.root.findAllByType(Text).map((node) => node.props.children);
}

async function press(renderer: ReactTestRenderer, testID: string) {
  await act(async () => {
    renderer.root.findByProps({ testID }).props.onPress();
  });
}

describe('ReceiptFileNameSettingsScreen', () => {
  beforeEach(() => {
    mockRouterBack.mockClear();
  });

  describe('options', () => {
    it('lists the automatic default and the four formats with their examples, default selected when nothing is stored', async () => {
      const renderer = await renderScreen(new InMemorySettingsRepository());

      expect(texts(renderer)).toContainEqual(DEFAULT_LABEL);
      for (const id of RECEIPT_FILE_NAME_FORMAT_IDS) {
        expect(texts(renderer)).toContainEqual(RECEIPT_FILE_NAME_FORMAT_EXAMPLES[id]);
        expect(isSelected(renderer, id)).toBe(false);
      }
      expect(isSelected(renderer, 'default')).toBe(true);
      expect(option(renderer, 'default').props.accessibilityRole).toBe('radio');
    });

    it('marks the stored format as selected instead of the default', async () => {
      const settings = new InMemorySettingsRepository();
      await settings.set(RECEIPT_FILE_NAME_FORMAT_KEY, 'name-year-month');

      const renderer = await renderScreen(settings);

      expect(isSelected(renderer, 'name-year-month')).toBe(true);
      expect(isSelected(renderer, 'default')).toBe(false);
      expect(isSelected(renderer, 'month-year')).toBe(false);
    });

    it('shows the default as selected when the stored value is corrupt', async () => {
      const settings = new InMemorySettingsRepository();
      await settings.set(RECEIPT_FILE_NAME_FORMAT_KEY, 'not-a-format');

      const renderer = await renderScreen(settings);

      expect(isSelected(renderer, 'default')).toBe(true);
      for (const id of RECEIPT_FILE_NAME_FORMAT_IDS) {
        expect(isSelected(renderer, id)).toBe(false);
      }
    });

    it('renders the helper copy verbatim', async () => {
      const renderer = await renderScreen(new InMemorySettingsRepository());

      expect(texts(renderer)).toContainEqual(HELPER_COPY);
    });

    it('shows a loading state before the stored value resolves', async () => {
      const pending: SettingsRepository = {
        get: () => new Promise(() => {}),
        set: () => Promise.reject(new Error('unused')),
      };

      let renderer!: ReactTestRenderer;
      await act(async () => {
        renderer = create(
          <RepositoryProvider
            repositories={{
              employers: fakeEmployerRepository,
              employees: fakeEmployeeRepository,
              payrollRuns: fakePayrollRunRepository,
              settings: pending,
            }}
          >
            <ReceiptFileNameSettingsScreen />
          </RepositoryProvider>,
        );
      });

      expect(texts(renderer)).toContainEqual('Cargando…');
      expect(
        renderer.root.findAllByProps({ testID: 'receipt-file-name-option-default' }),
      ).toHaveLength(0);
    });
  });

  describe('selecting and saving (design D3)', () => {
    it('stages a selection on press without persisting or leaving', async () => {
      const settings = new InMemorySettingsRepository();
      const renderer = await renderScreen(settings);

      await press(renderer, 'receipt-file-name-option-month-year');

      expect(isSelected(renderer, 'month-year')).toBe(true);
      expect(isSelected(renderer, 'default')).toBe(false);
      await expect(settings.get(RECEIPT_FILE_NAME_FORMAT_KEY)).resolves.toBeNull();
      expect(mockRouterBack).not.toHaveBeenCalled();
    });

    it('persists the selected format on Guardar and then goes back', async () => {
      const settings = new InMemorySettingsRepository();
      const renderer = await renderScreen(settings);

      await press(renderer, 'receipt-file-name-option-month-year');
      await press(renderer, 'receipt-file-name-submit');

      await expect(settings.get(RECEIPT_FILE_NAME_FORMAT_KEY)).resolves.toBe('month-year');
      expect(mockRouterBack).toHaveBeenCalledTimes(1);
    });

    it('stores the unset marker when the default is chosen over a stored format', async () => {
      const settings = new InMemorySettingsRepository();
      await settings.set(RECEIPT_FILE_NAME_FORMAT_KEY, 'name-month-year');
      const renderer = await renderScreen(settings);

      await press(renderer, 'receipt-file-name-option-default');
      await press(renderer, 'receipt-file-name-submit');

      await expect(settings.get(RECEIPT_FILE_NAME_FORMAT_KEY)).resolves.toBe('');
      expect(mockRouterBack).toHaveBeenCalledTimes(1);
    });

    it('stays on the screen and shows the fixed error when saving fails', async () => {
      const failing: SettingsRepository = {
        get: async () => null,
        set: () => Promise.reject(new Error('disk exploded')),
      };
      const renderer = await renderScreen(failing);

      await press(renderer, 'receipt-file-name-option-month-year');
      await press(renderer, 'receipt-file-name-submit');

      expect(
        renderer.root.findByProps({ testID: 'receipt-file-name-save-error' }).props.children,
      ).toBe('No se pudo guardar el ajuste.');
      expect(mockRouterBack).not.toHaveBeenCalled();
    });

    it('disables Guardar and shows a saving label while the write is in flight', async () => {
      let release: (() => void) | undefined;
      const slow: SettingsRepository = {
        get: async () => null,
        set: (key, value) =>
          new Promise((resolve) => {
            release = () => resolve({ key, value });
          }),
      };
      const renderer = await renderScreen(slow);

      let pending!: Promise<void>;
      await act(async () => {
        pending = Promise.resolve(
          renderer.root.findByProps({ testID: 'receipt-file-name-submit' }).props.onPress(),
        );
      });

      expect(renderer.root.findByProps({ testID: 'receipt-file-name-submit' }).props.disabled).toBe(
        true,
      );
      expect(texts(renderer)).toContainEqual('Guardando…');

      await act(async () => {
        release?.();
        await pending;
      });
    });
  });
});
