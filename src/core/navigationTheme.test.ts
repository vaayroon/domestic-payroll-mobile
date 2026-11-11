import { appNavigationTheme } from './navigationTheme';

describe('appNavigationTheme', () => {
  it('is a dark theme whose header and scene match the slate-900 screen bodies', () => {
    expect(appNavigationTheme.dark).toBe(true);
    expect(appNavigationTheme.colors.background).toBe('#0f172a');
    expect(appNavigationTheme.colors.card).toBe('#0f172a');
  });

  it('uses a light header title colour so titles stay readable on the dark header', () => {
    expect(appNavigationTheme.colors.text).toBe('#f8fafc');
  });
});
