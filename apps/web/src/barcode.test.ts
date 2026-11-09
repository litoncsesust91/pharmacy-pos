import { describe, expect, it } from 'vitest';
import { isSafeScannerValue, normalizeScannerValue } from './barcode';

describe('barcode input boundary', () => {
  it('normalizes scanner terminators and accepts bounded barcode values', () => {
    expect(normalizeScannerValue(' 8901234567890\r\n')).toBe('8901234567890');
    expect(isSafeScannerValue('8901234567890')).toBe(true);
  });

  it('rejects malformed or injection-like scanner payloads', () => {
    expect(isSafeScannerValue('<script>alert(1)</script>')).toBe(false);
    expect(isSafeScannerValue('a')).toBe(false);
    expect(isSafeScannerValue('barcode value')).toBe(false);
  });
});
