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

  describe('readable file name', () => {
    it('records a null file name for a call without one, and the random-looking uri stays as before', async () => {
      const generator = new FakeReceiptPdfGenerator();

      const result = await generator.generate('<html>plain</html>');

      expect(generator.lastFileName).toBeNull();
      expect(result.uri).toBe('file:///fake/cache/Print/recibo-1.pdf');
    });

    it('records the file name and puts the uri under receipts/fake-<n>/ with that name', async () => {
      const generator = new FakeReceiptPdfGenerator();

      const result = await generator.generate('<html>named</html>', { fileName: 'Nomina-Octubre2026' });

      expect(generator.lastFileName).toBe('Nomina-Octubre2026');
      expect(result).toEqual({ uri: 'file:///fake/cache/receipts/fake-1/Nomina-Octubre2026.pdf' });
    });

    it('still hands out a distinct uri when the same name is used twice', async () => {
      const generator = new FakeReceiptPdfGenerator();

      const first = await generator.generate('<html>1</html>', { fileName: 'Nomina-Octubre2026' });
      const second = await generator.generate('<html>2</html>', { fileName: 'Nomina-Octubre2026' });

      expect(first.uri).toBe('file:///fake/cache/receipts/fake-1/Nomina-Octubre2026.pdf');
      expect(second.uri).toBe('file:///fake/cache/receipts/fake-2/Nomina-Octubre2026.pdf');
    });

    it('resets to null on a later unnamed call and keeps carrying the password next to the name', async () => {
      const generator = new FakeReceiptPdfGenerator();

      await generator.generate('<html>a</html>', { fileName: 'Nomina-Octubre2026', password: '00000000T' });
      expect(generator.lastFileName).toBe('Nomina-Octubre2026');
      expect(generator.lastPassword).toBe('00000000T');

      await generator.generate('<html>b</html>');
      expect(generator.lastFileName).toBeNull();
    });

    it('records the file name even when the call is rejected through nextError', async () => {
      const generator = new FakeReceiptPdfGenerator();
      generator.nextError = new Error('boom');

      await expect(generator.generate('<html>x</html>', { fileName: 'Nomina-Octubre2026' })).rejects.toThrow('boom');

      expect(generator.lastFileName).toBe('Nomina-Octubre2026');
    });
  });
});
