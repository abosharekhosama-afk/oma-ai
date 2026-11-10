import { describe, expect, it } from 'vitest';
import {
  checkSsrfHost,
  isBlockedIp,
  isLoopbackIp,
  isPrivateIpv4,
  normalizeIpLiteral,
} from './ssrf-policy';

describe('ssrf-policy', () => {
  it('blocks localhost', () => {
    expect(checkSsrfHost('localhost').ok).toBe(false);
  });

  it('blocks metadata hostnames', () => {
    expect(checkSsrfHost('metadata.google.internal').ok).toBe(false);
    expect(checkSsrfHost('metadata').ok).toBe(false);
  });

  it('blocks private ipv4 ranges', () => {
    expect(isPrivateIpv4('127.0.0.1')).toBe(true);
    expect(isPrivateIpv4('10.0.0.1')).toBe(true);
    expect(isPrivateIpv4('192.168.1.1')).toBe(true);
    expect(isPrivateIpv4('172.16.0.1')).toBe(true);
    expect(isPrivateIpv4('169.254.169.254')).toBe(true);
    expect(isBlockedIp('0.0.0.0')).toBe(true);
    expect(isBlockedIp('100.64.1.2')).toBe(true);
    expect(isBlockedIp('224.0.0.1')).toBe(true);
    expect(isBlockedIp('240.0.0.1')).toBe(true);
  });

  it('blocks ipv6 loopback, ula, link-local and multicast', () => {
    expect(isBlockedIp('::1')).toBe(true);
    expect(isBlockedIp('::')).toBe(true);
    expect(isBlockedIp('fc00::1')).toBe(true);
    expect(isBlockedIp('fd12:3456:789a::1')).toBe(true);
    expect(isBlockedIp('fe80::1')).toBe(true);
    expect(isBlockedIp('ff02::1')).toBe(true);
    expect(checkSsrfHost('::1').ok).toBe(false);
  });

  it('unwraps ipv4-mapped ipv6 and blocks private mapped addresses', () => {
    expect(normalizeIpLiteral('::ffff:127.0.0.1')).toBe('127.0.0.1');
    expect(isBlockedIp('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedIp('::ffff:169.254.169.254')).toBe(true);
    expect(isBlockedIp('::ffff:a00:1')).toBe(true);
  });

  it('does not treat public hostnames as ipv6 ula prefixes', () => {
    expect(checkSsrfHost('facebook.com').ok).toBe(true);
    expect(checkSsrfHost('example.test').ok).toBe(true);
  });

  it('allows public hosts and can permit loopback only when opted in', () => {
    expect(checkSsrfHost('example.test').ok).toBe(true);
    expect(isLoopbackIp('127.0.0.1')).toBe(true);
    expect(checkSsrfHost('127.0.0.1', { allowLoopback: true }).ok).toBe(true);
    expect(checkSsrfHost('localhost', { allowLoopback: true }).ok).toBe(true);
    expect(isBlockedIp('169.254.169.254', { allowLoopback: true })).toBe(true);
    expect(isBlockedIp('10.0.0.5', { allowLoopback: true })).toBe(true);
  });
});
