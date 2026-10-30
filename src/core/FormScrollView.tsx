/**
 * Scrollable form container that stays usable with the soft keyboard open.
 *
 * Expo SDK 54 draws Android apps edge-to-edge, so the window is no longer
 * resized when the keyboard opens and an input low in the form ends up behind
 * it, together with the submit button. React Native's `KeyboardAvoidingView`
 * was tried first and failed on device: its padding came out wrong and stayed
 * after the keyboard closed, clipping the end of the form. Keyboard
 * Controller's `KeyboardAwareScrollView` (the option the Expo keyboard guide
 * recommends) reads the keyboard from the native window insets instead and
 * scrolls the focused input into view. It needs `KeyboardProvider` at the root
 * (`src/app/_layout.tsx`) and a development build, since it is a native module.
 */

import { remapProps } from 'nativewind';
import type { ReactNode } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

/** Gap kept between the focused input and the top of the keyboard. */
const FOCUSED_INPUT_KEYBOARD_GAP = 24;

// A third-party component: NativeWind v4 needs the className props mapped to
// the style props it should fill.
const StyledKeyboardAwareScrollView = remapProps(KeyboardAwareScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});

export interface FormScrollViewProps {
  readonly contentContainerClassName?: string;
  readonly children: ReactNode;
}

export function FormScrollView({ contentContainerClassName, children }: FormScrollViewProps) {
  return (
    <StyledKeyboardAwareScrollView
      className="flex-1 bg-slate-900"
      contentContainerClassName={contentContainerClassName}
      bottomOffset={FOCUSED_INPUT_KEYBOARD_GAP}
      // Keeps the submit button tappable with the keyboard open.
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </StyledKeyboardAwareScrollView>
  );
}
