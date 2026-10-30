/**
 * Render test for `ReminderSettingsScreen`'s layout. The settings flow itself
 * is covered by `useReminderSettings.test.tsx`; here the hook is stubbed.
 */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { FormScrollView } from '@/core';

import type { UseReminderSettingsResult } from '../hooks/useReminderSettings';
import { ReminderSettingsScreen } from './ReminderSettingsScreen';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ back: jest.fn() }),
}));

const mockLoadedSettings: UseReminderSettingsResult = {
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
});
