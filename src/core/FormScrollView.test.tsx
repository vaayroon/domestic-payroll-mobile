/**
 * Render test for `FormScrollView`: the keyboard-aware scroll container that
 * keeps the focused input and the submit button above the Android keyboard.
 */

import { Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
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
  it('scrolls the focused input above the keyboard with a gap', () => {
    const renderer = render(
      <FormScrollView>
        <Text>field</Text>
      </FormScrollView>,
    );

    const scroll = renderer.root.findByType(KeyboardAwareScrollView);
    expect(scroll.props.bottomOffset).toBeGreaterThan(0);
  });

  it('keeps taps working while the keyboard is open and renders its children', () => {
    const renderer = render(
      <FormScrollView contentContainerClassName="gap-4 p-4">
        <Text>field</Text>
      </FormScrollView>,
    );

    const scroll = renderer.root.findByType(KeyboardAwareScrollView);
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scroll.findByType(Text).props.children).toBe('field');
  });
});
