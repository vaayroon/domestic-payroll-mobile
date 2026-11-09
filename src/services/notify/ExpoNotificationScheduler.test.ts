import * as Notifications from 'expo-notifications';

import { ExpoNotificationScheduler, FOREGROUND_PRESENTATION } from './ExpoNotificationScheduler';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
}));

const setNotificationHandler = jest.mocked(Notifications.setNotificationHandler);

describe('ExpoNotificationScheduler foreground handler', () => {
  beforeEach(() => {
    setNotificationHandler.mockClear();
  });

  it('installs a notification handler on construction', () => {
    new ExpoNotificationScheduler();

    expect(setNotificationHandler).toHaveBeenCalledTimes(1);
  });

  it('presents a foregrounded notification in the tray and as a banner, silently', async () => {
    new ExpoNotificationScheduler();
    const handler = setNotificationHandler.mock.calls[0]?.[0];
    if (handler === null || handler === undefined) {
      throw new Error('expected a notification handler');
    }

    const behavior = await handler.handleNotification({} as Notifications.Notification);

    expect(behavior).toEqual(FOREGROUND_PRESENTATION);
    expect(behavior).toMatchObject({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false });
  });
});
