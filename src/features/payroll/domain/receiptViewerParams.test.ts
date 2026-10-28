import { isReceiptPdfUri, parseReceiptViewerParams } from './receiptViewerParams';

const VALID_URI = 'file:///data/user/0/app/cache/Print/receipt.pdf';

describe('isReceiptPdfUri', () => {
  it('accepts a file:/// uri ending in .pdf', () => {
    expect(isReceiptPdfUri(VALID_URI)).toBe(true);
  });

  it('is case-insensitive on the extension and scheme', () => {
    expect(isReceiptPdfUri('file:///cache/Receipt.PDF')).toBe(true);
    expect(isReceiptPdfUri('FILE:///cache/receipt.pdf')).toBe(true);
  });

  it.each([
    ['https', 'https://example.test/a.pdf'],
    ['http', 'http://example.test/a.pdf'],
    ['content', 'content://provider/a.pdf'],
    ['data', 'data:application/pdf;base64,AAAA'],
    ['file with two slashes (host form)', 'file://host/a.pdf'],
    ['a non-pdf extension', 'file:///cache/a.png'],
    ['no extension', 'file:///cache/receipt'],
    ['a pdf extension only as a prefix', 'file:///cache/a.pdf.png'],
    ['a query suffix', 'file:///cache/a.pdf?x=1'],
    ['a hash suffix', 'file:///cache/a.pdf#page=2'],
    ['a query before the extension', 'file:///cache/a?x=1.pdf'],
    ['a hash before the extension', 'file:///cache/a#x.pdf'],
    ['a parent-directory segment', 'file:///cache/../secret/a.pdf'],
    ['a trailing parent-directory segment', 'file:///cache/a/../b.pdf'],
    ['an empty string', ''],
    ['only the scheme', 'file:///'],
    ['a lowercase percent-encoded parent segment', 'file:///data/user/0/app/cache/%2e%2e/a.pdf'],
    ['an uppercase percent-encoded parent segment', 'file:///data/user/0/app/cache/%2E%2E/a.pdf'],
    ['a mixed literal and encoded parent segment', 'file:///data/user/0/app/cache/.%2e/a.pdf'],
    ['an encoded slash', 'file:///data/user/0/app/cache%2f..%2fsecret/a.pdf'],
    ['a lone malformed percent', 'file:///data/user/0/app/cache/a%.pdf'],
    ['a path outside a cache directory', 'file:///data/user/0/app/files/receipt.pdf'],
    ['a cache name that is only a prefix of a segment', 'file:///data/user/0/app/cache2/a.pdf'],
    ['cache as the file name rather than a directory', 'file:///data/user/0/app/cache.pdf'],
    ['an empty path segment', 'file:///data/user/0/app/cache//a.pdf'],
    ['a current-directory segment', 'file:///data/user/0/app/cache/./a.pdf'],
    ['a four-slash prefix', 'file:////data/user/0/app/cache/a.pdf'],
  ])('rejects %s', (_label, uri) => {
    expect(isReceiptPdfUri(uri)).toBe(false);
  });

  it('accepts the uri shape expo-print produces in the app cache', () => {
    expect(isReceiptPdfUri('file:///data/user/0/com.example.app/cache/Print/receipt.pdf')).toBe(
      true,
    );
  });

  it('does not treat a file name containing dots as a parent-directory segment', () => {
    expect(isReceiptPdfUri('file:///cache/receipt..v2.pdf')).toBe(true);
  });
});

describe('parseReceiptViewerParams', () => {
  it('accepts three non-empty single strings with a valid uri', () => {
    expect(
      parseReceiptViewerParams({ employeeId: 'emp-1', runId: 'run-1', uri: VALID_URI }),
    ).toEqual({
      ok: true,
      employeeId: 'emp-1',
      runId: 'run-1',
      uri: VALID_URI,
    });
  });

  it('accepts a case-insensitive .PDF extension', () => {
    const uri = 'file:///cache/RECEIPT.PDF';
    expect(parseReceiptViewerParams({ employeeId: 'emp-1', runId: 'run-1', uri })).toEqual({
      ok: true,
      employeeId: 'emp-1',
      runId: 'run-1',
      uri,
    });
  });

  it.each([
    ['https', 'https://example.test/a.pdf'],
    ['content', 'content://provider/a.pdf'],
    ['data', 'data:application/pdf;base64,AAAA'],
    ['a non-pdf file', 'file:///cache/a.png'],
    ['a query suffix', 'file:///cache/a.pdf?x=1'],
    ['a hash suffix', 'file:///cache/a.pdf#x'],
    ['a parent-directory segment', 'file:///cache/../a.pdf'],
    ['an encoded parent-directory segment', 'file:///cache/%2e%2e/a.pdf'],
    ['a path outside the app cache', 'file:///data/user/0/app/files/a.pdf'],
  ])('rejects a uri with %s', (_label, uri) => {
    expect(parseReceiptViewerParams({ employeeId: 'emp-1', runId: 'run-1', uri })).toEqual({
      ok: false,
    });
  });

  it('rejects an array uri', () => {
    expect(
      parseReceiptViewerParams({ employeeId: 'emp-1', runId: 'run-1', uri: [VALID_URI] }),
    ).toEqual({
      ok: false,
    });
    expect(
      parseReceiptViewerParams({
        employeeId: 'emp-1',
        runId: 'run-1',
        uri: [VALID_URI, VALID_URI],
      }),
    ).toEqual({
      ok: false,
    });
  });

  it('rejects array ids', () => {
    expect(
      parseReceiptViewerParams({ employeeId: ['emp-1'], runId: 'run-1', uri: VALID_URI }),
    ).toEqual({
      ok: false,
    });
    expect(
      parseReceiptViewerParams({ employeeId: 'emp-1', runId: ['run-1'], uri: VALID_URI }),
    ).toEqual({
      ok: false,
    });
  });

  it('rejects empty values', () => {
    expect(parseReceiptViewerParams({ employeeId: '', runId: 'run-1', uri: VALID_URI })).toEqual({
      ok: false,
    });
    expect(parseReceiptViewerParams({ employeeId: 'emp-1', runId: '', uri: VALID_URI })).toEqual({
      ok: false,
    });
    expect(parseReceiptViewerParams({ employeeId: 'emp-1', runId: 'run-1', uri: '' })).toEqual({
      ok: false,
    });
  });

  it('rejects missing values', () => {
    expect(parseReceiptViewerParams({})).toEqual({ ok: false });
    expect(parseReceiptViewerParams({ runId: 'run-1', uri: VALID_URI })).toEqual({ ok: false });
    expect(parseReceiptViewerParams({ employeeId: 'emp-1', uri: VALID_URI })).toEqual({
      ok: false,
    });
    expect(parseReceiptViewerParams({ employeeId: 'emp-1', runId: 'run-1' })).toEqual({
      ok: false,
    });
  });
});
