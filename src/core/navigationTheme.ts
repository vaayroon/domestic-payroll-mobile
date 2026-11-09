/**
 * Navigation theme for the Stack (headers, scene background, modal cards).
 *
 * Every screen body is styled dark (`bg-slate-900` + light text) regardless of
 * the device appearance, so the navigation chrome must be dark too. Following
 * the device scheme left a white header on a light-mode device, and any screen
 * whose own background did not paint (e.g. `FormScrollView`) showed React
 * Navigation's light-grey scene background behind white headings. The app is
 * therefore single-theme: one dark palette, mirroring the Tailwind slate and
 * emerald tokens used by the screens.
 */

import { DarkTheme, type Theme } from '@react-navigation/native';

/** Tailwind `slate-900`: the screen body colour. */
const SLATE_900 = '#0f172a';
/** Tailwind `slate-800`: header hairline, matches the list separators. */
const SLATE_800 = '#1e293b';
/** Tailwind `slate-50`: header title and default text. */
const SLATE_50 = '#f8fafc';
/** Tailwind `emerald-400`: back button tint, matches the header links. */
const EMERALD_400 = '#34d399';

export const appNavigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: EMERALD_400,
    background: SLATE_900,
    card: SLATE_900,
    text: SLATE_50,
    border: SLATE_800,
  },
};
