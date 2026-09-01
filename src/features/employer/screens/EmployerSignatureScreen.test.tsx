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
