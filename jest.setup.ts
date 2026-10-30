// Keyboard Controller is a native module; its own mock renders
// `KeyboardAwareScrollView` as a plain `ScrollView` under jest.
jest.mock('react-native-keyboard-controller', () => jest.requireActual('react-native-keyboard-controller/jest'));
