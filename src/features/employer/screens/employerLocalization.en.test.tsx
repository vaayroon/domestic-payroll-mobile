/**
 * English render tests for the employer slice (i18n-ui-chrome, commit 4).
 * The Spanish assertions live in the per-screen tests and stay unchanged.
 */

import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  CurrentEmployerProvider,
  RepositoryProvider,
  SignaturePadProvider,
  type Repositories,
} from '@/core';
import { i18n } from '@/core/i18n';
import { InMemorySettingsRepository } from '@/core/testing/fakes';
import {
  InMemoryEmployeeRepository,
  InMemoryEmployerRepository,
} from '@/features/employees/testing/fakes';
import { FakeSignaturePad } from '@/services/signature/testing/fakes';
import type { Employer, PayrollRunRepository, SettingsRepository } from '@/types';

import { EmployerSettingsScreen } from './EmployerSettingsScreen';
import { EmployerSignatureScreen } from './EmployerSignatureScreen';
import { ReceiptFileNameSettingsScreen } from './ReceiptFileNameSettingsScreen';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ back: jest.fn() }),
}));

// Obviously-fake placeholder identifiers/names only (CLAUDE.md §6).
const FAKE_EMPLOYER: Employer = {
  id: 'employer-fake-seed',
  name: 'Empleador de Prueba',
  nif: '00000000T',
  address: null,
  ccc: null,
  defaultLugar: null,
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

async function render(
  element: React.ReactElement,
  settings: SettingsRepository = new InMemorySettingsRepository(),
  employers: InMemoryEmployerRepository = new InMemoryEmployerRepository([FAKE_EMPLOYER]),
): Promise<ReactTestRenderer> {
  const repositories: Repositories = {
    employers,
    employees: new InMemoryEmployeeRepository([]),
    payrollRuns: fakePayrollRunRepository,
    settings,
  };

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <RepositoryProvider repositories={repositories}>
        <CurrentEmployerProvider>
          <SignaturePadProvider pad={FakeSignaturePad}>{element}</SignaturePadProvider>
        </CurrentEmployerProvider>
      </RepositoryProvider>,
    );
  });
  await act(async () => {
    for (let i = 0; i < 6; i += 1) {
      await Promise.resolve();
    }
  });
  return renderer;
}

function texts(renderer: ReactTestRenderer): string[] {
  return renderer.root.findAllByType(Text).map((node) => String(node.props.children));
}

describe('employer slice in English', () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });

  it('renders the employer settings labels and links in English', async () => {
    const renderer = await render(<EmployerSettingsScreen />);

    expect(texts(renderer)).toEqual(
      expect.arrayContaining([
        'Name',
        'NIF/NIE (optional)',
        'Address (optional)',
        'Place of issue (optional)',
        'Save changes',
        'Monthly reminder',
        'Employer signature',
        'Payslip file name',
      ]),
    );
  });

  it('shows English validation messages for an invalid employer form', async () => {
    const renderer = await render(<EmployerSettingsScreen />);

    await act(async () => {
      renderer.root.findByProps({ testID: 'employer-form-name' }).props.onChangeText('');
      renderer.root.findByProps({ testID: 'employer-form-nif' }).props.onChangeText('12');
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'employer-form-submit' }).props.onPress();
    });

    expect(texts(renderer)).toEqual(
      expect.arrayContaining(['The name is required.', 'The NIF/NIE format is not valid.']),
    );
  });

  it('renders the signature screen in English', async () => {
    const renderer = await render(<EmployerSignatureScreen />);

    expect(texts(renderer)).toEqual(
      expect.arrayContaining([
        'Employer signature',
        'The signature is stored on this device only.',
        'No signature saved',
        'Save signature',
        'Clear',
        'Delete saved signature',
      ]),
    );
  });

  it('renders the file name screen in English and maps a save failure code', async () => {
    const failing: SettingsRepository = {
      get: async () => null,
      set: async () => {
        throw new Error('disk full');
      },
    };
    const renderer = await render(<ReceiptFileNameSettingsScreen />, failing);

    expect(texts(renderer)).toEqual(
      expect.arrayContaining([
        'Payslip file name',
        'Automatic name (random)',
        'The file name is visible when you share or send it, even if the payslip is password-protected.',
      ]),
    );

    await act(async () => {
      renderer.root.findByProps({ testID: 'receipt-file-name-submit' }).props.onPress();
    });

    expect(texts(renderer)).toContain('Could not save the setting.');
  });
});
