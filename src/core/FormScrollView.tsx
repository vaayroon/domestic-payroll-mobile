/**
 * Scrollable form container that stays usable with the soft keyboard open.
 *
 * Expo SDK 54 draws Android apps edge-to-edge, so the window is no longer
 * resized when the keyboard opens and an input low in the form ends up behind
 * it, together with the submit button. `KeyboardAvoidingView` with `padding`
 * adds the keyboard height as bottom padding on both platforms, which lets the
 * inner `ScrollView` scroll the last fields above the keyboard.
 *
 * `KeyboardAvoidingView` measures its own frame relative to its parent, not to
 * the screen, so the stack header above it must be passed as
 * `keyboardVerticalOffset` or the padding comes out short by the header height.
 * `HeaderHeightContext` is undefined outside a navigator (tests, modals without
 * a header), which means no offset.
 */

import { HeaderHeightContext } from '@react-navigation/elements';
import { useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';

export interface FormScrollViewProps {
  readonly contentContainerClassName?: string;
  readonly children: ReactNode;
}

export function FormScrollView({ contentContainerClassName, children }: FormScrollViewProps) {
  const headerHeight = useContext(HeaderHeightContext) ?? 0;

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} className="flex-1 bg-slate-900">
      <ScrollView
        className="flex-1"
        contentContainerClassName={contentContainerClassName}
        // Keeps the submit button tappable with the keyboard open.
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
