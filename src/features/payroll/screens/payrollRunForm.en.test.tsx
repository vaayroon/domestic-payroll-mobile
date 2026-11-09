/**
 * English render tests for the payroll slice (i18n-ui-chrome, commit 5).
 * The Spanish assertions live in the per-view tests and stay unchanged.
 */

import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { i18n } from '@/core/i18n';
import type { Employee } from '@/types';
import { cents } from '@/types/money';
import { makeEmployee } from '@/features/employees/testing/fixtures';

import type { PayrollResult } from '../domain';
import { PayrollRunForm, type PayrollRunFormProps } from './components/PayrollRunForm';

// `Intl.NumberFormat('es-ES', ...)` inserts a NON-BREAKING SPACE before `€`.
const NBSP = '\u00a0';

const FAKE_EMPLOYEE: Employee = makeEmployee({ id: 'employee-fake-1', name: 'Empleada de Prueba' });

const PREVIEW: PayrollResult = {
  grossCents: cents(1234567),
  ssDeductionCents: cents(1000),
  netCents: cents(1233567),
  prorated: true,
} as PayrollResult;

const formProps: PayrollRunFormProps = {
  employees: [FAKE_EMPLOYEE],
  employeesLoading: false,
  selectedEmployeeId: FAKE_EMPLOYEE.id,
  onSelectEmployee: () => {},
  periodYear: 2026,
  periodMonth: 6,
  onIncrementMonth: () => {},
  onDecrementMonth: () => {},
  extraPayMode: 'EXCLUDE',
  onChangeExtraPayMode: () => {},
  periodStartDate: null,
  onChangePeriodStartDate: () => {},
  periodEndDate: null,
  onChangePeriodEndDate: () => {},
  rangeError: null,
  preview: PREVIEW,
  ratesWarning: null,
  saving: false,
  error: null,
  onSubmit: () => {},
};

const mounted: ReactTestRenderer[] = [];

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(element);
  });
  mounted.push(renderer);
  return renderer;
}

function texts(renderer: ReactTestRenderer): string[] {
  return renderer.root.findAllByType(Text).map((node) =>
    [node.props.children]
      .flat(Infinity)
      .filter((c) => typeof c === 'string')
      .join(''),
  );
}

function child(renderer: ReactTestRenderer, testID: string): unknown {
  return renderer.root.findByProps({ testID }).props.children;
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

// A mounted tree would still be subscribed when the language resets to `es`.
afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount());
  });
});

describe('payroll run form localization (en)', () => {
  it('renders the form chrome in English with es-ES money and an English month', async () => {
    const renderer = await render(<PayrollRunForm {...formProps} />);
    const all = texts(renderer);

    expect(all).toEqual(
      expect.arrayContaining([
        'Employee',
        'Period',
        'Days worked range',
        'From',
        'To',
        'Prorate every month',
        'Prorated month.',
        'Calculate and save payroll',
      ]),
    );
    expect(child(renderer, 'payroll-run-form-period-label')).toBe('June 2026');
    expect(child(renderer, 'payroll-run-form-preview-gross')).toBe(`12.345,67${NBSP}€`);
    expect(
      renderer.root.findByProps({ testID: 'payroll-run-form-period-start' }).props.placeholder,
    ).toBe('YYYY-MM-DD');
  });

  it('maps form error codes to English', async () => {
    const renderer = await render(
      <PayrollRunForm
        {...formProps}
        preview={null}
        ratesWarning="rates_not_loaded"
        rangeError="range_invalid"
        error={{
          code: 'duplicate_run',
          employeeName: 'Empleada de Prueba',
          periodYear: 2026,
          periodMonth: 6,
        }}
      />,
    );

    expect(child(renderer, 'payroll-run-form-rates-warning')).toBe(
      'The contribution rates for this year have not been loaded. The payroll cannot be calculated.',
    );
    expect(child(renderer, 'payroll-run-form-range-error')).toBe(
      'The start date cannot be after the end date.',
    );
    expect(child(renderer, 'payroll-run-form-error')).toBe(
      'A payroll already exists for Empleada de Prueba in 6/2026.',
    );
  });
});
