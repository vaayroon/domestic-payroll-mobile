import { FakeReceiptPdfGenerator } from './fakes';

describe('FakeReceiptPdfGenerator', () => {
  it('records the html and a null password for a plain generation', async () => {
    const generator = new FakeReceiptPdfGenerator();

    const result = await generator.generate('<html>plain</html>');

    expect(result).toEqual({ uri: 'file:///fake/cache/Print/recibo-1.pdf' });
    expect(generator.lastHtml).toBe('<html>plain</html>');
    expect(generator.lastPassword).toBeNull();
  });

  it('records the password of the most recent call, and resets it on a later plain call', async () => {
    const generator = new FakeReceiptPdfGenerator();

    await generator.generate('<html>a</html>', { password: '00000000T' });
    expect(generator.lastPassword).toBe('00000000T');

    await generator.generate('<html>b</html>');
    expect(generator.lastPassword).toBeNull();
  });

  it('hands out a distinct uri per generation', async () => {
    const generator = new FakeReceiptPdfGenerator();

    const first = await generator.generate('<html>1</html>');
    const second = await generator.generate('<html>2</html>');

    expect(first.uri).not.toBe(second.uri);
  });

  it('rejects once with nextError, recording the call, then recovers', async () => {
    const generator = new FakeReceiptPdfGenerator();
    generator.nextError = new Error('Receipt encryption failed');

    await expect(generator.generate('<html>x</html>', { password: 'X0000000T' })).rejects.toThrow(
      'Receipt encryption failed',
    );
    expect(generator.lastPassword).toBe('X0000000T');
    expect(generator.nextError).toBeNull();

    // The failed call consumed no uri, so the first success is still recibo-1.
    await expect(generator.generate('<html>y</html>')).resolves.toEqual({
      uri: 'file:///fake/cache/Print/recibo-1.pdf',
    });
  });

  it('collects discarded uris in order and never throws', async () => {
    const generator = new FakeReceiptPdfGenerator();

    await generator.discard('file:///fake/cache/Print/recibo-1.pdf');
    await generator.discard('file:///fake/cache/Print/recibo-2.pdf');

    expect(generator.discarded).toEqual([
      'file:///fake/cache/Print/recibo-1.pdf',
      'file:///fake/cache/Print/recibo-2.pdf',
    ]);
  });
});
