import { describe, expect, it } from 'vitest';
import { hasCapability } from './capabilities';

describe('capabilities', () => {
  it('denies by default', () => {
    expect(hasCapability([], 'tenant.manage')).toBe(false);
  });
  it('requires all by default', () => {
    expect(hasCapability(['a'], ['a', 'b'])).toBe(false);
    expect(hasCapability(['a', 'b'], ['a', 'b'])).toBe(true);
  });
  it('supports any mode', () => {
    expect(hasCapability(['a'], ['a', 'b'], 'any')).toBe(true);
  });
});
