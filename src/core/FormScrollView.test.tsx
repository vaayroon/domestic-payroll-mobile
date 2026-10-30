/**
 * Render test for `FormScrollView`: the keyboard-avoiding wrapper that keeps
 * the focused input and the submit button above the Android keyboard.
 */

import { HeaderHeightContext } from '@react-navigation/elements';
import { KeyboardAvoidingView, ScrollView, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { FormScrollView } from './FormScrollView';

function render(element: React.ReactElement): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(element);
  });
  if (renderer === undefined) {
    throw new Error('renderer not created');
  }
  return renderer;
}

describe('FormScrollView', () => {
  it('pads the content by the keyboard height and offsets it by the stack header height', () => {
    const renderer = render(
      <HeaderHeightContext.Provider value={84}>
        <FormScrollView>
          <Text>field</Text>
        </FormScrollView>
      </HeaderHeightContext.Provider>,
    );

    const avoiding = renderer.root.findByType(KeyboardAvoidingView);
    expect(avoiding.props.behavior).toBe('padding');
    expect(avoiding.props.keyboardVerticalOffset).toBe(84);
  });

  it('uses no offset when rendered outside a navigator header', () => {
    const renderer = render(
      <FormScrollView>
        <Text>field</Text>
      </FormScrollView>,
    );

    expect(renderer.root.findByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(0);
  });

  it('scrolls its children and keeps taps working while the keyboard is open', () => {
    const renderer = render(
      <FormScrollView contentContainerClassName="gap-4 p-4">
        <Text>field</Text>
      </FormScrollView>,
    );

    const scroll = renderer.root.findByType(ScrollView);
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scroll.findByType(Text).props.children).toBe('field');
  });
});
