// Initialise the global i18n instance synchronously, as the app does at import.
// (babel-jest hoists the jest.mock calls below above this import.)
import './src/core/i18n/i18n';

// Keyboard Controller is a native module; its own mock renders
// `KeyboardAwareScrollView` as a plain `ScrollView` under jest.
jest.mock('react-native-keyboard-controller', () => jest.requireActual('react-native-keyboard-controller/jest'));

// jest-expo ships no mock for expo-localization (native module). Pin the device
// to Spanish so i18n initialises in `es` and the existing Spanish-literal tests
// pass unchanged. Tests that need English switch via i18n.changeLanguage('en').
jest.mock('expo-localization', () => {
  const locales = [{ languageCode: 'es', languageTag: 'es-ES' }];
  return { getLocales: () => locales, useLocales: () => locales };
});
