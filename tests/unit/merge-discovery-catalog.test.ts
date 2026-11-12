import { describe, expect, it } from 'vitest';
import { mergeCatalogFieldValues, parseCatalogFieldValue } from '@oma/domain';

describe('merge-discovery-catalog', () => {
  it('parses catalog JSON insight', () => {
    const value = parseCatalogFieldValue(JSON.stringify({ summary: 'A', items: [{ name: 'A' }] }));
    expect(value?.items.length).toBe(1);
  });

  it('merges without duplicate names', () => {
    const merged = mergeCatalogFieldValues({ summary: 'Widget', items: [{ name: 'Widget' }] }, [
      { name: 'widget' },
      { name: 'New item' },
    ]);
    expect(merged.items).toHaveLength(2);
    expect(merged.items.map((i) => i.name)).toEqual(['Widget', 'New item']);
  });
});
