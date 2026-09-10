import { describe, expect, it } from 'vitest';
import { assertInfoClass, isValidInfoClass, preserveUnknown } from '@oma/domain';

describe('foundation info class', () => {
  it('validates and asserts foundation field infoClass', () => {
    expect(isValidInfoClass('USER_AUTHORED')).toBe(true);
    expect(assertInfoClass('UNKNOWN')).toBe('UNKNOWN');
    expect(preserveUnknown('UNKNOWN')).toBe('UNKNOWN');
  });
});
