/**
 * Render test for `ReminderSettingsScreen`'s layout. The settings flow itself
 * is covered by `useReminderSettings.test.tsx`; here the hook is stubbed.
 */

import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { FormScrollView } from '@/core';
import { i18n } from '@/core/i18n';

import type { UseReminderSettingsResult } from '../hooks/useReminderSettings';
import { ReminderSettingsScreen } from './ReminderSettingsScreen';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ back: jest.fn() }),
}));

let mockLoadedSettings: UseReminderSettingsResult = {
  loading: false,
  values: { enabled: true, dayOfMonth: 28, hour: 9, minute: 0 },
  setEnabled: () => {},
  setDayOfMonth: () => {},
  setHour: () => {},
  setMinute: () => {},
  submit: async () => true,
  saving: false,
  saveError: null,
  permissionDenied: false,
};

jest.mock('../hooks', () => ({
  useReminderSettings: () => mockLoadedSettings,
}));

async function renderScreen(): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<ReminderSettingsScreen />);
  });
  return renderer;
}

describe('ReminderSettingsScreen', () => {
  it('scrolls the form so the save button stays reachable above the keyboard', async () => {
    const renderer = await renderScreen();

    const scroll = renderer.root.findByType(FormScrollView);
    expect(scroll.findByProps({ testID: 'reminder-settings-submit' })).toBeTruthy();
  });

  describe('in English', () => {
    const defaultSettings = mockLoadedSettings;

    beforeEach(async () => {
      await act(async () => {
        await i18n.changeLanguage('en');
      });
    });

    afterEach(() => {
      mockLoadedSettings = defaultSettings;
    });

    it('renders the screen copy in English', async () => {
      mockLoadedSettings = {
        ...defaultSettings,
        permissionDenied: true,
        saveError: { code: 'save_failed', detail: 'disk full' },
      };

      const renderer = await renderScreen();

      const texts = renderer.root.findAllByType(Text).map((node) => String(node.props.children));
      expect(texts).toEqual(
        expect.arrayContaining([
          'Monthly reminder',
          'Reminder on',
          'Day of the month',
          'Time',
          'Turn on notifications in the system settings to receive the reminder.',
          'Could not save: disk full',
          'Save',
        ]),
      );
    });
  });
});
