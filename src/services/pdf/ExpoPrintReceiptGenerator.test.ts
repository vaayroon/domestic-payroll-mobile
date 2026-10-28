import * as Print from 'expo-print';

import { A4_HEIGHT_PX, A4_WIDTH_PX, ExpoPrintReceiptGenerator } from './ExpoPrintReceiptGenerator';

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(),
}));

const printToFileAsync = jest.mocked(Print.printToFileAsync);

describe('ExpoPrintReceiptGenerator', () => {
  beforeEach(() => {
    printToFileAsync.mockReset();
    printToFileAsync.mockResolvedValue({
      uri: 'file:///fake/cache/Print/recibo.pdf',
      numberOfPages: 1,
    });
  });

  it('renders the HTML at A4 page size instead of the US Letter default', async () => {
    const generator = new ExpoPrintReceiptGenerator();

    await generator.generate('<html><body>recibo</body></html>');

    expect(printToFileAsync).toHaveBeenCalledTimes(1);
    expect(printToFileAsync).toHaveBeenCalledWith({
      html: '<html><body>recibo</body></html>',
      width: 595,
      height: 842,
    });
  });

  it('exports the A4 dimensions it passes to expo-print', () => {
    expect(A4_WIDTH_PX).toBe(595);
    expect(A4_HEIGHT_PX).toBe(842);
  });

  it('returns only the generated file uri', async () => {
    const generator = new ExpoPrintReceiptGenerator();

    const result = await generator.generate('<html></html>');

    expect(result).toEqual({ uri: 'file:///fake/cache/Print/recibo.pdf' });
  });
});
