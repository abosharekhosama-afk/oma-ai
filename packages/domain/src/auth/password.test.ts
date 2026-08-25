import { describe, expect, it } from 'vitest';
import { assertPasswordPolicy, hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('hashes and verifies', async () => {
    const hash = await hashPassword('CorrectHorseBattery1!');
    expect(hash).not.toContain('CorrectHorse');
    expect(await verifyPassword(hash, 'CorrectHorseBattery1!')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });

  it('enforces policy', () => {
    expect(() => assertPasswordPolicy('short')).toThrow();
  });
});
