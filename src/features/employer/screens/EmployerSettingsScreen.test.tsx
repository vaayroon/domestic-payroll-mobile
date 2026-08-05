/**
 * Render test for the `EmployerSettingsScreen` container: renders the four
 * fields seeded from the current employer, maps validation error codes to
 * Spanish messages, and exercises the save flow — all via
 * `InMemoryEmployerRepository` + `RepositoryProvider` (mirrors
 * `useEmployerForm.test.tsx`'s harness).
 */

import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { CurrentEmployerProvider, RepositoryProvider, type Repositories } from '@/core';
import { InMemoryEmployeeRepository, InMemoryEmployerRepository } from '@/features/employees/testing/fakes';
import type { Employer, PayrollRunRepository, SettingsRepository } from '@/types';

import { EmployerSettingsScreen } from './EmployerSettingsScreen';

// `router.back()` requires a live navigation tree (`assertIsReady` throws
// outside one); these tests render the screen standalone via
// `RepositoryProvider`, so `useRouter` is mocked the same way a real
// navigation container would satisfy it.
const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ back: mockRouterBack }),
}));

// Obviously-fake placeholder identifiers/names only (CLAUDE.md §6).
const FAKE_EMPLOYER: Employer = {
  id: 'employer-fake-seed',
  name: 'Empleador de Prueba',
  nif: '00000000T',
  address: 'Calle Falsa 123',
  ccc: '28000000000',
  createdAt: 0,
};

function notImplemented(method: string): () => never {
  return () => {
    throw new Error(`not implemented in this test fake: ${method}`);
  };
}

const fakePayrollRunRepository: PayrollRunRepository = {
  listByEmployee: notImplemented('PayrollRunRepository.listByEmployee'),
  getByPeriod: notImplemented('PayrollRunRepository.getByPeriod'),
  create: notImplemented('PayrollRunRepository.create'),
  remove: notImplemented('PayrollRunRepository.remove'),
};

const fakeSettingsRepository: SettingsRepository = {
  get: notImplemented('SettingsRepository.get'),
  set: notImplemented('SettingsRepository.set'),
};

async function renderScreen(employerRepository: InMemoryEmployerRepository): Promise<ReactTestRenderer> {
  const repositories: Repositories = {
    employers: employerRepository,
    employees: new InMemoryEmployeeRepository([]),
    payrollRuns: fakePayrollRunRepository,
    settings: fakeSettingsRepository,
  };

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <RepositoryProvider repositories={repositories}>
        <CurrentEmployerProvider>
          <EmployerSettingsScreen />
        </CurrentEmployerProvider>
      </RepositoryProvider>,
    );
  });
  // Flush bootstrap + load-by-id microtasks.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return renderer;
}

describe('EmployerSettingsScreen', () => {
  it('renders the four fields seeded from the current employer', async () => {
    const renderer = await renderScreen(new InMemoryEmployerRepository([FAKE_EMPLOYER]));

    expect(renderer.root.findByProps({ testID: 'employer-form-name' }).props.value).toBe('Empleador de Prueba');
    expect(renderer.root.findByProps({ testID: 'employer-form-nif' }).props.value).toBe('00000000T');
    expect(renderer.root.findByProps({ testID: 'employer-form-address' }).props.value).toBe('Calle Falsa 123');
    expect(renderer.root.findByProps({ testID: 'employer-form-ccc' }).props.value).toBe('28000000000');
  });

  it('maps an invalid nif error code to a Spanish message on save attempt', async () => {
    const renderer = await renderScreen(new InMemoryEmployerRepository([FAKE_EMPLOYER]));

    await act(async () => {
      renderer.root.findByProps({ testID: 'employer-form-nif' }).props.onChangeText('12345678A');
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'employer-form-submit' }).props.onPress();
    });

    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContainEqual('La letra de control del NIF/NIE no es correcta.');
  });

  it('maps an invalid ccc error code to a Spanish message on save attempt', async () => {
    const renderer = await renderScreen(new InMemoryEmployerRepository([FAKE_EMPLOYER]));

    await act(async () => {
      renderer.root.findByProps({ testID: 'employer-form-ccc' }).props.onChangeText('123');
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'employer-form-submit' }).props.onPress();
    });

    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContainEqual('El nº de cuenta de cotización debe tener 11 dígitos.');
  });

  it('saves valid edits through the repository', async () => {
    const repository = new InMemoryEmployerRepository([FAKE_EMPLOYER]);
    const updateSpy = jest.spyOn(repository, 'update');
    const renderer = await renderScreen(repository);

    await act(async () => {
      renderer.root.findByProps({ testID: 'employer-form-name' }).props.onChangeText('Empleador Actualizado');
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'employer-form-submit' }).props.onPress();
    });

    expect(updateSpy).toHaveBeenCalledWith(FAKE_EMPLOYER.id, {
      name: 'Empleador Actualizado',
      nif: '00000000T',
      address: 'Calle Falsa 123',
      ccc: '28000000000',
    });
  });

  it('shows a loading state before the employer resolves', async () => {
    const repository = new InMemoryEmployerRepository([FAKE_EMPLOYER]);
    // Never-resolving bootstrap list() keeps `CurrentEmployerProvider` (and
    // therefore the form) in the loading state for the lifetime of this
    // test, instead of racing a later out-of-`act` state update.
    jest.spyOn(repository, 'list').mockReturnValue(new Promise(() => {}));

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <RepositoryProvider
          repositories={{
            employers: repository,
            employees: new InMemoryEmployeeRepository([]),
            payrollRuns: fakePayrollRunRepository,
            settings: fakeSettingsRepository,
          }}
        >
          <CurrentEmployerProvider>
            <EmployerSettingsScreen />
          </CurrentEmployerProvider>
        </RepositoryProvider>,
      );
    });

    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContainEqual('Cargando…');
  });

  it('disables the submit button and shows a saving label while saving', async () => {
    const repository = new InMemoryEmployerRepository([FAKE_EMPLOYER]);
    let resolveUpdate: (() => void) | undefined;
    jest.spyOn(repository, 'update').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = () => resolve(FAKE_EMPLOYER);
        }),
    );
    const renderer = await renderScreen(repository);

    let submitPromise!: Promise<void>;
    await act(async () => {
      submitPromise = Promise.resolve(renderer.root.findByProps({ testID: 'employer-form-submit' }).props.onPress());
    });

    expect(renderer.root.findByProps({ testID: 'employer-form-submit' }).props.disabled).toBe(true);
    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContainEqual('Guardando…');

    await act(async () => {
      resolveUpdate?.();
      await submitPromise;
    });
  });
});
