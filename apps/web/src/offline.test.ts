import { describe, expect, it } from 'vitest';
import { isCacheFresh } from './offline';

describe('offline cache policy', () => {
  it('expires stale catalog data', () => {
    const now = 100_000;
    expect(isCacheFresh(now - 1_000, now, 10_000)).toBe(true);
    expect(isCacheFresh(now - 11_000, now, 10_000)).toBe(false);
    expect(isCacheFresh(now + 1, now, 10_000)).toBe(false);
  });
});
