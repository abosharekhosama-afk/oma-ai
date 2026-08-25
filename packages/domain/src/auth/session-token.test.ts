import { describe, expect, it } from 'vitest';
import { hashSessionToken, issueSessionToken } from './session-token';

describe('session-token', () => {
  it('issues opaque token and stable hash', () => {
    const a = issueSessionToken();
    expect(a.token.length).toBeGreaterThan(20);
    expect(hashSessionToken(a.token)).toBe(a.tokenHash);
    expect(hashSessionToken('other')).not.toBe(a.tokenHash);
  });
});
