/**
 * Render test for `EmployerSignatureScreen` (design ADR-5/ADR-7): exercises
 * the full screen against `FakeSignaturePad` through `SignaturePadProvider`,
 * and the shared `InMemorySettingsRepository` through `RepositoryProvider`
 * (mirrors `EmployerSettingsScreen.test.tsx`'s harness).
 */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { RepositoryProvider, SignaturePadProvider, type Repositories } from '@/core';
import { InMemorySettingsRepository } from '@/core/testing/fakes';
import { SYNTHETIC_SIGNATURE_PNG_BASE64 } from '@/core/testing/fixtures';
import { FakeSignaturePad, setFakeSignaturePadBehavior } from '@/services/signature/testing/fakes';
import type { EmployeeRepository, EmployerRepository, PayrollRunRepository, SettingsRepository } from '@/types';

import { EmployerSignatureScreen } from './EmployerSignatureScreen';

// `router.back()` requires a live navigation tree (`assertIsReady` throws
// outside one); these tests render the screen standalone via
// `RepositoryProvider`, so `useRouter` is mocked the same way a real
// navigation container would satisfy it (mirrors
// `EmployerSettingsScreen.test.tsx`).
const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ back: mockRouterBack }),
}));

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
        <SignaturePadProvider pad={FakeSignaturePad}>
          <EmployerSignatureScreen />
        </SignaturePadProvider>
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

describe('EmployerSignatureScreen', () => {
  beforeEach(() => {
    setFakeSignaturePadBehavior({ kind: 'ready-with-signature' });
    mockRouterBack.mockClear();
  });

  it('shows "Sin firma guardada" when nothing is persisted', async () => {
    const renderer = await renderScreen(new InMemorySettingsRepository());

    expect(renderer.root.findByProps({ testID: 'signature-settings-status' }).props.children).toBe(
      'Sin firma guardada',
    );
  });

  it('save calls controls.capture() and persists the resulting signature', async () => {
    const settings = new InMemorySettingsRepository();
    const renderer = await renderScreen(settings);

    await act(async () => {
      renderer.root.findByProps({ testID: 'signature-settings-save' }).props.onPress();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderer.root.findByProps({ testID: 'signature-settings-status' }).props.children).toBe('Firma guardada');
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it('onEmpty shows the empty-canvas error and persists nothing', async () => {
    setFakeSignaturePadBehavior({ kind: 'ready-empty' });
    const renderer = await renderScreen(new InMemorySettingsRepository());

    await act(async () => {
      renderer.root.findByProps({ testID: 'signature-settings-save' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'signature-settings-error' }).props.children).toBe(
      'Dibuja tu firma antes de guardar.',
    );
    expect(renderer.root.findByProps({ testID: 'signature-settings-status' }).props.children).toBe(
      'Sin firma guardada',
    );
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it('delete clears a previously saved signature', async () => {
    const settings = new InMemorySettingsRepository();
    const renderer = await renderScreen(settings);

    // First save one, so there is something to delete.
    await act(async () => {
      renderer.root.findByProps({ testID: 'signature-settings-save' }).props.onPress();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(renderer.root.findByProps({ testID: 'signature-settings-status' }).props.children).toBe('Firma guardada');

    await act(async () => {
      renderer.root.findByProps({ testID: 'signature-settings-delete' }).props.onPress();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderer.root.findByProps({ testID: 'signature-settings-status' }).props.children).toBe(
      'Sin firma guardada',
    );
    // Only saving dismisses the screen; deleting leaves the user on it so the
    // cleared state is visible and a new signature can be drawn right away.
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it('renders the mapped copy for a load_failed pad failure', async () => {
    setFakeSignaturePadBehavior({ kind: 'load-failed' });
    const renderer = await renderScreen(new InMemorySettingsRepository());

    expect(renderer.root.findByProps({ testID: 'signature-settings-error' }).props.children).toBe(
      'No se pudo abrir el panel de firma.',
    );
  });

  it('renders the mapped copy for a capture_failed pad failure', async () => {
    setFakeSignaturePadBehavior({ kind: 'capture-failed' });
    const renderer = await renderScreen(new InMemorySettingsRepository());

    await act(async () => {
      renderer.root.findByProps({ testID: 'signature-settings-save' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'signature-settings-error' }).props.children).toBe(
      'No se pudo leer la firma.',
    );
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it('never renders the raw synthetic payload as text (privacy)', async () => {
    const settings = new InMemorySettingsRepository();
    const renderer = await renderScreen(settings);

    await act(async () => {
      renderer.root.findByProps({ testID: 'signature-settings-save' }).props.onPress();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(JSON.stringify(renderer.toJSON())).not.toContain(SYNTHETIC_SIGNATURE_PNG_BASE64);
  });
});
