import { describe, expect, it } from 'vitest';
import {
  formatStorageBytes,
  storageUsageLabel,
  storageUsageView,
} from '../../apps/web/src/lib/storage-usage';
import { pageOf, parseFilePage } from '../../apps/api/src/media/media.service';

const MB = 1024 * 1024;
const GB = 1024 * MB;

describe('storage usage', () => {
  it('formats small usage in KB/MB instead of 0.00 GB', () => {
    expect(formatStorageBytes(0)).toBe('0 B');
    expect(formatStorageBytes(812 * 1024)).toBe('812 KB');
    expect(formatStorageBytes(3.4 * MB)).toBe('3.4 MB');
    expect(formatStorageBytes(10 * GB)).toBe('10 GB');
  });

  it('computes an exact share and a visible bar once anything is stored', () => {
    const v = storageUsageView(3.4 * MB, 10 * GB);
    expect(v.pct).toBe(0);
    expect(v.barPct).toBe(1);
    expect(v.remaining).toBe(10 * GB - 3.4 * MB);
    expect(v.tone).toBe('ok');
    expect(storageUsageLabel(v, 'en')).toBe('3.4 MB of 10 GB (<0.1%)');
    expect(storageUsageLabel(v, 'ar')).toBe('3.4 MB من 10 GB (<0.1%)');
    expect(storageUsageView(0, 10 * GB).barPct).toBe(0);
  });

  it('warns near the limit, flags over-quota and handles unlimited plans', () => {
    expect(storageUsageView(8.5 * GB, 10 * GB)).toMatchObject({ pct: 85, tone: 'warn' });
    expect(storageUsageView(11 * GB, 10 * GB)).toMatchObject({
      pct: 100,
      barPct: 100,
      tone: 'over',
    });
    const unlimited = storageUsageView(2 * GB, null);
    expect(unlimited).toMatchObject({ unlimited: true, pct: null, remaining: null });
    expect(storageUsageLabel(unlimited, 'en')).toBe('2 GB · Unlimited');
  });
});

describe('media browse paging', () => {
  it('clamps file_limit / file_offset', () => {
    expect(parseFilePage({})).toEqual({ limit: null, offset: 0 });
    expect(parseFilePage({ file_limit: '48', file_offset: '96' })).toEqual({
      limit: 48,
      offset: 96,
    });
    expect(parseFilePage({ file_limit: '999', file_offset: '-4' })).toEqual({
      limit: 120,
      offset: 0,
    });
    expect(parseFilePage({ file_limit: '0' })).toEqual({ limit: 1, offset: 0 });
  });

  it('returns one page and whether more remain', () => {
    const files = Array.from({ length: 100 }, (_, i) => i);
    expect(pageOf(files, { limit: 48, offset: 0 })).toMatchObject({ total: 100, hasMore: true });
    expect(pageOf(files, { limit: 48, offset: 48 }).items[0]).toBe(48);
    const last = pageOf(files, { limit: 48, offset: 96 });
    expect(last.items).toEqual([96, 97, 98, 99]);
    expect(last.hasMore).toBe(false);
    expect(pageOf(files, { limit: null, offset: 0 }).items).toHaveLength(100);
  });
});
