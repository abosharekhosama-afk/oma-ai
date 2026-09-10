import { describe, expect, it } from 'vitest';
import {
  STRATEGY_INFO_CLASSES,
  assertInfoClass,
  isValidInfoClass,
  preserveUnknown,
  requireInfoClassOnMaterial,
} from '@oma/domain';

describe('strategy info class', () => {
  it('accepts known classes including UNKNOWN', () => {
    expect(STRATEGY_INFO_CLASSES).toContain('USER_AUTHORED');
    expect(STRATEGY_INFO_CLASSES).toContain('UNKNOWN');
    expect(isValidInfoClass('USER_AUTHORED')).toBe(true);
    expect(isValidInfoClass('bogus')).toBe(false);
  });

  it('preserves UNKNOWN without coercion', () => {
    expect(preserveUnknown('UNKNOWN')).toBe('UNKNOWN');
    expect(assertInfoClass('USER_AUTHORED')).toBe('USER_AUTHORED');
  });

  it('requires infoClass on material fields', () => {
    expect(requireInfoClassOnMaterial({ value: 'x', infoClass: 'USER_AUTHORED' })).toBeNull();
    expect(requireInfoClassOnMaterial({ value: 'x' })).toBe('MISSING_INFO_CLASS');
  });
});
