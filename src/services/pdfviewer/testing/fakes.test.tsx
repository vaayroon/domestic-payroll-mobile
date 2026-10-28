/**
 * Behaviour tests for `FakePdfViewer` (design "Fake"): the fake is the only
 * PDF surface screen tests ever mount, so its knob must be trustworthy.
 */

import { act, create } from 'react-test-renderer';

import {
  FakePdfViewer,
  getFakePdfViewerLastUri,
  getFakePdfViewerMountCount,
  setFakePdfViewerBehavior,
} from './fakes';

const URI = 'file:///cache/Print/receipt.pdf';

function mountFake(onLoad: jest.Mock, onFailure: jest.Mock) {
  return act(async () => {
    create(<FakePdfViewer uri={URI} onLoad={onLoad} onFailure={onFailure} />);
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
});
