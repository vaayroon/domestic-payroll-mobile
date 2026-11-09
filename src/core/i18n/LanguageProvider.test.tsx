/**
 * LanguageProvider (design D8/D10): render gate until `ui.language` is read,
 * override vs device resolution, failed read = follow device, live switch,
 * persist-first `setPreference`.
 */

import type * as LocalizationModule from 'expo-localization';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { RepositoryProvider, type Repositories } from '../RepositoryProvider';
import { InMemorySettingsRepository } from '../testing/fakes';
import type { AppSetting, SettingsRepository } from '@/types';

import { i18n } from './i18n';
import { LanguageProvider, useLanguagePreference } from './LanguageProvider';
import { UI_LANGUAGE_KEY } from './languagePreference';
import { useTranslation } from './index';

// jest.setup.ts already mocks expo-localization (device = es); override the
// hook per test instead of re-mocking the module.
// (`import * as` would copy the mock object, so the spy must target the real one.)
function setDeviceLanguage(languageCode: string): void {
  const locales = [{ languageCode, languageTag: languageCode }] as unknown as LocalizationModule.Locale[];
  const localization = jest.requireMock<typeof LocalizationModule>('expo-localization');
  jest.spyOn(localization, 'useLocales').mockReturnValue(locales);
}

function notImplemented(method: string): () => never {
  return () => {
    throw new Error(`not implemented in this test fake: ${method}`);
  };
}

function repositories(settings: SettingsRepository): Repositories {
  return {
    employers: {
      list: notImplemented('list'),
      getById: notImplemented('getById'),
      create: notImplemented('create'),
      update: notImplemented('update'),
      remove: notImplemented('remove'),
    },
    employees: {
      list: notImplemented('list'),
      getById: notImplemented('getById'),
      create: notImplemented('create'),
      update: notImplemented('update'),
      remove: notImplemented('remove'),
    },
    payrollRuns: {
      listByEmployee: notImplemented('listByEmployee'),
      getByPeriod: notImplemented('getByPeriod'),
      create: notImplemented('create'),
      remove: notImplemented('remove'),
    },
    settings,
  };
}

// A provider left mounted would keep forcing its own language onto the shared
// i18n instance after the global afterEach reset, so every test unmounts.
const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => renderer.unmount());
  }
});

let latest: ReturnType<typeof useLanguagePreference> | null = null;

function Probe() {
  const { t } = useTranslation();
  latest = useLanguagePreference();
  return <Text testID="probe">{t(($) => $.app.titles.employees)}</Text>;
}

async function mount(settings: SettingsRepository): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <RepositoryProvider repositories={repositories(settings)}>
        <LanguageProvider>
          <Probe />
        </LanguageProvider>
      </RepositoryProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  mounted.push(renderer);
  return renderer;
}

function probeText(renderer: ReactTestRenderer): unknown {
  return renderer.root.findAllByType(Text)[0]?.props.children;
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    latest = null;
  });

  it('renders nothing until the stored preference has been read', async () => {
    let release!: (value: string | null) => void;
    const pending = new Promise<string | null>((resolve) => {
      release = resolve;
    });
    const settings: SettingsRepository = {
      get: () => pending,
      set: async (key, value): Promise<AppSetting> => ({ key, value }),
    };

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <RepositoryProvider repositories={repositories(settings)}>
          <LanguageProvider>
            <Probe />
          </LanguageProvider>
        </RepositoryProvider>,
      );
    });
    mounted.push(renderer);
    expect(renderer.toJSON()).toBeNull();

    await act(async () => {
      release('en');
      await pending;
    });
    expect(probeText(renderer)).toBe('Employees');
  });

  it('applies the stored override over the device language', async () => {
    const settings = new InMemorySettingsRepository();
    await settings.set(UI_LANGUAGE_KEY, 'en');

    const renderer = await mount(settings);

    expect(probeText(renderer)).toBe('Employees');
    expect(i18n.language).toBe('en');
    expect(latest?.preference).toBe('en');
  });

  it('follows the device language when nothing is stored', async () => {
    setDeviceLanguage('en');

    const renderer = await mount(new InMemorySettingsRepository());

    expect(probeText(renderer)).toBe('Employees');
    expect(latest?.preference).toBeNull();
    expect(latest?.language).toBe('en');
  });

  it('treats a garbage stored value as follow device', async () => {
    const settings = new InMemorySettingsRepository();
    await settings.set(UI_LANGUAGE_KEY, 'xx');

    const renderer = await mount(settings);

    expect(probeText(renderer)).toBe('Empleados');
    expect(latest?.preference).toBeNull();
  });

  it('treats a failed read as follow device', async () => {
    const settings: SettingsRepository = {
      get: async () => {
        throw new Error('db down');
      },
      set: async (key, value): Promise<AppSetting> => ({ key, value }),
    };

    const renderer = await mount(settings);

    expect(probeText(renderer)).toBe('Empleados');
    expect(latest?.preference).toBeNull();
  });

  it('switches live and persists when the preference changes', async () => {
    const settings = new InMemorySettingsRepository();
    const renderer = await mount(settings);
    expect(probeText(renderer)).toBe('Empleados');

    await act(async () => {
      await latest?.setPreference('en');
    });
    expect(probeText(renderer)).toBe('Employees');
    expect(await settings.get(UI_LANGUAGE_KEY)).toBe('en');

    await act(async () => {
      await latest?.setPreference(null);
    });
    expect(probeText(renderer)).toBe('Empleados');
    expect(await settings.get(UI_LANGUAGE_KEY)).toBe('');
  });

  it('never reports a language that differs from the one t uses', async () => {
    const renderer = await mount(new InMemorySettingsRepository());
    const seen: string[] = [];
    function Spy() {
      const { t } = useTranslation();
      const { language } = useLanguagePreference();
      seen.push(`${language}:${t(($) => $.app.titles.employees)}`);
      return null;
    }
    await act(async () => {
      renderer.update(
        <RepositoryProvider repositories={repositories(new InMemorySettingsRepository())}>
          <LanguageProvider>
            <Spy />
          </LanguageProvider>
        </RepositoryProvider>,
      );
    });
    seen.length = 0;

    await act(async () => {
      await latest?.setPreference('en');
    });

    for (const entry of seen) {
      expect(['es:Empleados', 'en:Employees']).toContain(entry);
    }
  });

  it('still renders children when changeLanguage rejects during the initial load', async () => {
    jest.spyOn(i18n, 'changeLanguage').mockRejectedValueOnce(new Error('boom'));

    const renderer = await mount(new InMemorySettingsRepository());

    expect(probeText(renderer)).toBe('Empleados');
    expect(latest?.language).toBe('es');
  });

  it('keeps the current language when the write fails', async () => {
    const settings: SettingsRepository = {
      get: async () => null,
      set: async () => {
        throw new Error('disk full');
      },
    };
    const renderer = await mount(settings);

    await act(async () => {
      await expect(latest?.setPreference('en')).rejects.toThrow('disk full');
    });

    expect(probeText(renderer)).toBe('Empleados');
    expect(latest?.preference).toBeNull();
  });
});
