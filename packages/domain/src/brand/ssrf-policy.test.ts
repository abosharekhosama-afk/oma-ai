import { describe, expect, it } from 'vitest';
import { checkSsrfHost, isPrivateIpv4 } from './ssrf-policy';

describe('ssrf-policy', () => {
  it('blocks localhost', () => {
    expect(checkSsrfHost('localhost').ok).toBe(false);
  });

  it('blocks metadata hostnames', () => {
    expect(checkSsrfHost('metadata.google.internal').ok).toBe(false);
  });

  it('blocks private ipv4 ranges', () => {
    expect(isPrivateIpv4('127.0.0.1')).toBe(true);
    expect(isPrivateIpv4('10.0.0.1')).toBe(true);
    expect(isPrivateIpv4('192.168.1.1')).toBe(true);
    expect(isPrivateIpv4('172.16.0.1')).toBe(true);
    expect(isPrivateIpv4('169.254.169.254')).toBe(true);
  });

  it('allows public hosts', () => {
    expect(checkSsrfHost('example.test').ok).toBe(true);
  });
});
