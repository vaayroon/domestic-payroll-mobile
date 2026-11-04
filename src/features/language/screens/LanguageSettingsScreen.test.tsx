/**
 * LanguageSettingsScreen: three options, current choice marked, selection
 * applies and persists, a failed write keeps the language and shows an error.
 */

import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { RepositoryProvider, type Repositories } from '@/core';
import { i18n, LanguageProvider, UI_LANGUAGE_KEY } from '@/core/i18n';
import { InMemorySettingsRepository } from '@/core/testing/fakes';
import type { AppSetting, SettingsRepository } from '@/types';

import { LanguageSettingsScreen } from './LanguageSettingsScreen';

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

// Unmount after each test: a provider left mounted would keep forcing its own
// language onto the shared i18n instance after the global afterEach reset.
const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => renderer.unmount());
  }
});

async function renderScreen(settings: SettingsRepository): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <RepositoryProvider repositories={repositories(settings)}>
        <LanguageProvider>
          <LanguageSettingsScreen />
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

function option(renderer: ReactTestRenderer, id: string) {
  const match = renderer.root
    .findAllByProps({ testID: `language-option-${id}` })
    .find((node) => node.props.accessibilityState !== undefined);
  if (match === undefined) {
    throw new Error(`option ${id} not found`);
  }
  return match;
}

function isSelected(renderer: ReactTestRenderer, id: string): boolean {
  return option(renderer, id).props.accessibilityState.selected === true;
}

function texts(renderer: ReactTestRenderer): unknown[] {
  return renderer.root.findAllByType(Text).map((node) => node.props.children);
}

async function choose(renderer: ReactTestRenderer, id: string) {
  await act(async () => {
    option(renderer, id).props.onPress();
  });
}

describe('LanguageSettingsScreen', () => {
  it('lists the three options in Spanish with Follow device selected by default', async () => {
    const renderer = await renderScreen(new InMemorySettingsRepository());

    expect(texts(renderer)).toContain('Seguir el idioma del dispositivo');
    expect(texts(renderer)).toContain('Español');
    expect(texts(renderer)).toContain('English');
    expect(isSelected(renderer, 'device')).toBe(true);
    expect(isSelected(renderer, 'es')).toBe(false);
    expect(isSelected(renderer, 'en')).toBe(false);
  });

  it('switches to English, persists it and marks it as current', async () => {
    const settings = new InMemorySettingsRepository();
    const renderer = await renderScreen(settings);

    await choose(renderer, 'en');

    expect(i18n.language).toBe('en');
    expect(await settings.get(UI_LANGUAGE_KEY)).toBe('en');
    expect(isSelected(renderer, 'en')).toBe(true);
    expect(texts(renderer)).toContain('Follow device language');
    expect(texts(renderer)).toContain('Selected');
  });

  it('returns to the device language and stores the empty marker', async () => {
    const settings = new InMemorySettingsRepository();
    await settings.set(UI_LANGUAGE_KEY, 'en');
    const renderer = await renderScreen(settings);
    expect(isSelected(renderer, 'en')).toBe(true);

    await choose(renderer, 'device');

    expect(await settings.get(UI_LANGUAGE_KEY)).toBe('');
    expect(i18n.language).toBe('es');
    expect(isSelected(renderer, 'device')).toBe(true);
  });

  it('keeps the current language and shows an error when the write fails', async () => {
    const settings: SettingsRepository = {
      get: async () => null,
      set: async (): Promise<AppSetting> => {
        throw new Error('disk full');
      },
    };
    const renderer = await renderScreen(settings);

    await choose(renderer, 'en');

    expect(i18n.language).toBe('es');
    expect(isSelected(renderer, 'device')).toBe(true);
    expect(texts(renderer)).toContain('No se pudo guardar el idioma. Inténtalo de nuevo.');
  });

  it('shows the error in English when the UI is English', async () => {
    const settings: SettingsRepository = {
      get: async () => 'en',
      set: async (): Promise<AppSetting> => {
        throw new Error('disk full');
      },
    };
    const renderer = await renderScreen(settings);

    await choose(renderer, 'es');

    expect(texts(renderer)).toContain('Could not save the language. Please try again.');
  });
});
