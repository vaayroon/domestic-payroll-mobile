/**
 * Render test for `CurrentEmployerProvider` (design ADR-2 / task 2.2): proves
 * the bootstrap is idempotent — first launch creates exactly one employer,
 * a repeated mount against a repository that already has one does not create
 * a second — using the same in-memory fake + `RepositoryProvider` injection
 * pattern as `SmokeScreen.test.tsx`.
 */

import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type {
  Employee,
  EmployeeRepository,
  Employer,
  EmployerRepository,
  NewEmployer,
  PayrollRunRepository,
  SettingsRepository,
} from '@/types';

import { i18n } from './i18n';
import { CurrentEmployerProvider, useCurrentEmployerId } from './CurrentEmployerProvider';
import { RepositoryProvider, type Repositories } from './RepositoryProvider';

function notImplemented(method: string): () => never {
  return () => {
    throw new Error(`not implemented in this test fake: ${method}`);
  };
}

/**
 * Minimal in-memory `EmployerRepository` fake local to this test. Not reused
 * from `features/employees/testing/fakes` because `core/` must never depend
 * on `features/*` (CLAUDE.md §3) — this file lives in `core/` alongside the
 * component it tests, so it needs its own tiny fake.
 */
class InMemoryEmployerRepository implements EmployerRepository {
  private readonly rows: Employer[];

  constructor(seed: Employer[] = []) {
    this.rows = [...seed];
  }

  async list(): Promise<Employer[]> {
    return [...this.rows].sort((a, b) => a.createdAt - b.createdAt);
  }

  async getById(id: string): Promise<Employer | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async create(input: NewEmployer): Promise<Employer> {
    const employer: Employer = {
      id: 'employer-fake-seed',
      name: input.name,
      nif: input.nif ?? null,
      address: input.address ?? null,
      ccc: input.ccc ?? null,
      defaultLugar: input.defaultLugar ?? null,
      createdAt: Date.now(),
    };
    this.rows.push(employer);
    return employer;
  }

  async update(): Promise<Employer> {
    return notImplemented('EmployerRepository.update')();
  }

  async remove(): Promise<void> {
    return notImplemented('EmployerRepository.remove')();
  }
}

const fakeEmployeeRepository: EmployeeRepository = {
  list: async () => [] as Employee[],
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

const fakeSettingsRepository: SettingsRepository = {
  get: notImplemented('SettingsRepository.get'),
  set: notImplemented('SettingsRepository.set'),
};

function EmployerIdProbe() {
  const employerId = useCurrentEmployerId();
  return <Text testID="employer-id">{employerId}</Text>;
}

async function renderWithEmployers(employers: Employer[]): Promise<{
  renderer: ReactTestRenderer;
  repository: InMemoryEmployerRepository;
}> {
  const repository = new InMemoryEmployerRepository(employers);
  const repositories: Repositories = {
    employers: repository,
    employees: fakeEmployeeRepository,
    payrollRuns: fakePayrollRunRepository,
    settings: fakeSettingsRepository,
  };

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <RepositoryProvider repositories={repositories}>
        <CurrentEmployerProvider>
          <EmployerIdProbe />
        </CurrentEmployerProvider>
      </RepositoryProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  return { renderer, repository };
}

describe('CurrentEmployerProvider', () => {
  it('creates exactly one employer on first launch', async () => {
    const { renderer, repository } = await renderWithEmployers([]);

    const probe = renderer.root.findByProps({ testID: 'employer-id' });
    expect(typeof probe.props.children).toBe('string');

    const all = await repository.list();
    expect(all).toHaveLength(1);
  });

  it('does not create a second employer when one already exists', async () => {
    const seedEmployer: Employer = {
      id: 'employer-fake-seed',
      name: 'Empleador',
      nif: null,
      address: null,
      ccc: null,
      defaultLugar: null,
      createdAt: 0,
    };

    const { renderer, repository } = await renderWithEmployers([seedEmployer]);

    const probe = renderer.root.findByProps({ testID: 'employer-id' });
    expect(probe.props.children).toBe('employer-fake-seed');

    const all = await repository.list();
    expect(all).toHaveLength(1);
  });

  describe('startup screens', () => {
    function reposWith(employers: EmployerRepository): Repositories {
      return {
        employers,
        employees: fakeEmployeeRepository,
        payrollRuns: fakePayrollRunRepository,
        settings: fakeSettingsRepository,
      };
    }

    async function renderStartup(employers: EmployerRepository, settle: boolean): Promise<ReactTestRenderer> {
      let renderer!: ReactTestRenderer;
      await act(async () => {
        renderer = create(
          <RepositoryProvider repositories={reposWith(employers)}>
            <CurrentEmployerProvider>
              <EmployerIdProbe />
            </CurrentEmployerProvider>
          </RepositoryProvider>,
        );
      });
      if (settle) {
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });
      }
      return renderer;
    }

    function texts(renderer: ReactTestRenderer): unknown[] {
      return renderer.root.findAllByType(Text).map((node) => node.props.children);
    }

    const failing: EmployerRepository = {
      ...new InMemoryEmployerRepository(),
      list: async () => {
        throw new Error('db down');
      },
      getById: notImplemented('getById'),
      create: notImplemented('create'),
      update: notImplemented('update'),
      remove: notImplemented('remove'),
    };

    const pending: EmployerRepository = {
      list: () => new Promise<Employer[]>(() => undefined),
      getById: notImplemented('getById'),
      create: notImplemented('create'),
      update: notImplemented('update'),
      remove: notImplemented('remove'),
    };

    it('shows the Spanish loading and error copy by default', async () => {
      const loading = await renderStartup(pending, false);
      expect(texts(loading)).toContain('Cargando…');
      const errored = await renderStartup(failing, true);
      expect(texts(errored)).toContain('No se pudo iniciar la aplicación. Reinicia la app.');
    });

    it('shows the English loading and error copy when the language is English', async () => {
      await act(async () => {
        await i18n.changeLanguage('en');
      });
      const loading = await renderStartup(pending, false);
      expect(texts(loading)).toContain('Loading…');
      const errored = await renderStartup(failing, true);
      expect(texts(errored)).toContain('The app could not start. Please restart it.');
    });
  });
});
