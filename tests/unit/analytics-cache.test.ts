import { describe, expect, it, vi } from 'vitest';
import {
  AnalyticsCache,
  MemoryStore,
  normaliseParams,
  type CacheStore,
} from '../../apps/api/src/analytics/analytics-cache';

const scope = (tenantId: string, userId = 'u1', params = 'period=30') => ({
  tenantId,
  userId,
  name: 'content',
  params,
});

describe('analytics cache', () => {
  it('serves repeat reads from cache within the TTL', async () => {
    const cache = new AnalyticsCache(null);
    const compute = vi.fn(async () => ({ n: 1 }));
    expect(await cache.wrap(scope('t1'), compute)).toEqual({ n: 1 });
    expect(await cache.wrap(scope('t1'), compute)).toEqual({ n: 1 });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('never shares entries across tenants, users or params', async () => {
    const cache = new AnalyticsCache(null);
    await cache.wrap(scope('t1'), async () => ({ tenant: 't1' }));
    expect(await cache.wrap(scope('t2'), async () => ({ tenant: 't2' }))).toEqual({ tenant: 't2' });
    expect(await cache.wrap(scope('t1', 'u2'), async () => ({ tenant: 'u2' }))).toEqual({
      tenant: 'u2',
    });
    expect(await cache.wrap(scope('t1', 'u1', 'period=7'), async () => 'p7')).toBe('p7');
    expect(await cache.wrap(scope('t1'), async () => 'miss')).toEqual({ tenant: 't1' });
  });

  it('bypasses the cache without a tenant or user', async () => {
    const cache = new AnalyticsCache(null);
    const compute = vi.fn(async () => 1);
    await cache.wrap(scope(''), compute);
    await cache.wrap(scope(''), compute);
    await cache.wrap({ ...scope('t1'), userId: '' }, compute);
    expect(compute).toHaveBeenCalledTimes(3);
  });

  it('expires entries after the TTL', async () => {
    let t = 1_000_000;
    const cache = new AnalyticsCache(null, () => t);
    const compute = vi.fn(async () => t);
    await cache.wrap(scope('t1'), compute, 60);
    t += 59_000;
    await cache.wrap(scope('t1'), compute, 60);
    expect(compute).toHaveBeenCalledTimes(1);
    t += 2_000;
    await cache.wrap(scope('t1'), compute, 60);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('invalidating one tenant drops only that tenant', async () => {
    const cache = new AnalyticsCache(null);
    await cache.wrap(scope('t1'), async () => 'old-1');
    await cache.wrap(scope('t2'), async () => 'old-2');
    await cache.invalidateTenant('t1');
    expect(await cache.wrap(scope('t1'), async () => 'new-1')).toBe('new-1');
    expect(await cache.wrap(scope('t2'), async () => 'new-2')).toBe('old-2');
  });

  it('falls back to memory when the primary store errors', async () => {
    const broken: CacheStore = {
      get: async () => {
        throw new Error('down');
      },
      set: async () => {
        throw new Error('down');
      },
      incr: async () => {
        throw new Error('down');
      },
    };
    const cache = new AnalyticsCache(broken);
    const compute = vi.fn(async () => 'v');
    await cache.wrap(scope('t1'), compute);
    await cache.wrap(scope('t1'), compute);
    expect(compute).toHaveBeenCalledTimes(1);
    await cache.invalidateTenant('t1');
    await cache.wrap(scope('t1'), compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('uses the primary store (Redis) keys scoped by tenant', async () => {
    const mem = new MemoryStore();
    const keys: string[] = [];
    const spy: CacheStore = {
      get: (k) => mem.get(k),
      set: (k, v, ttl) => {
        keys.push(k);
        return mem.set(k, v, ttl);
      },
      incr: (k) => mem.incr(k),
    };
    const cache = new AnalyticsCache(spy);
    await cache.wrap(scope('tA'), async () => 1);
    await cache.wrap(scope('tB'), async () => 2);
    expect(keys[0]).toContain(':tA:');
    expect(keys[1]).toContain(':tB:');
    expect(keys[0]).not.toContain('tB');
  });

  it('normalises params into a stable key', () => {
    expect(normaliseParams({ b: '2', a: '1', c: undefined, d: '' })).toBe('a=1&b=2');
    expect(normaliseParams({ a: '1', b: '2' })).toBe(normaliseParams({ b: '2', a: '1' }));
  });

  it('caps the in-memory store size', async () => {
    const m = new MemoryStore();
    for (let i = 0; i < 700; i++) await m.set(`k${i}`, 'v', 60);
    expect(m.size).toBeLessThanOrEqual(500);
    expect(await m.get('k699')).toBe('v');
    expect(await m.get('k0')).toBeNull();
  });
});
