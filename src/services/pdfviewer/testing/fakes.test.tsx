/**
 * Behaviour tests for `FakePdfViewer` (design "Fake"): the fake is the only
 * PDF surface screen tests ever mount, so its knob must be trustworthy.
 */

import { act, create } from 'react-test-renderer';

import {
  FakePdfViewer,
  getFakePdfViewerLastPassword,
  getFakePdfViewerLastUri,
  getFakePdfViewerMountCount,
  setFakePdfViewerBehavior,
} from './fakes';

const URI = 'file:///cache/Print/receipt.pdf';

function mountFake(onLoad: jest.Mock, onFailure: jest.Mock, password?: string) {
  return act(async () => {
    create(<FakePdfViewer uri={URI} password={password} onLoad={onLoad} onFailure={onFailure} />);
  });
}

describe('FakePdfViewer', () => {
  beforeEach(() => {
    setFakePdfViewerBehavior({ kind: 'loaded', pageCount: 1 });
  });

  it('loads with one page by default', async () => {
    const onLoad = jest.fn();
    const onFailure = jest.fn();
    await mountFake(onLoad, onFailure);
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledWith(1);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('loads with the configured page count', async () => {
    setFakePdfViewerBehavior({ kind: 'loaded', pageCount: 3 });
    const onLoad = jest.fn();
    await mountFake(onLoad, jest.fn());
    expect(onLoad).toHaveBeenCalledWith(3);
  });

  it("reports onFailure('load_failed') in error mode", async () => {
    setFakePdfViewerBehavior({ kind: 'error' });
    const onLoad = jest.fn();
    const onFailure = jest.fn();
    await mountFake(onLoad, onFailure);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith('load_failed');
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('fires nothing in pending mode', async () => {
    setFakePdfViewerBehavior({ kind: 'pending' });
    const onLoad = jest.fn();
    const onFailure = jest.fn();
    await mountFake(onLoad, onFailure);
    expect(onLoad).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('records the last uri and the mount count, and resets both on setFakePdfViewerBehavior', async () => {
    expect(getFakePdfViewerLastUri()).toBeNull();
    expect(getFakePdfViewerMountCount()).toBe(0);

    await mountFake(jest.fn(), jest.fn());
    expect(getFakePdfViewerLastUri()).toBe(URI);
    expect(getFakePdfViewerMountCount()).toBe(1);

    setFakePdfViewerBehavior({ kind: 'pending' });
    expect(getFakePdfViewerLastUri()).toBeNull();
    expect(getFakePdfViewerMountCount()).toBe(0);
  });

  it('records the password the viewer was mounted with, and null when none was given', async () => {
    expect(getFakePdfViewerLastPassword()).toBeNull();

    await mountFake(jest.fn(), jest.fn(), '00000000T');
    expect(getFakePdfViewerLastPassword()).toBe('00000000T');

    setFakePdfViewerBehavior({ kind: 'loaded', pageCount: 1 });
    expect(getFakePdfViewerLastPassword()).toBeNull();

    await mountFake(jest.fn(), jest.fn());
    expect(getFakePdfViewerLastPassword()).toBeNull();
  });
});
