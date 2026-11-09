const scannerPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{2,63}$/;

export function normalizeScannerValue(value: string): string {
  return value.trim().replace(/[\r\n\t]/g, '');
}

export function isSafeScannerValue(value: string): boolean {
  return scannerPattern.test(normalizeScannerValue(value));
}
