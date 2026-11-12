import { describe, expect, it } from 'vitest';
import { groupInsightsByFieldAndValue, likelySpaShell } from '../../apps/web/src/lib/brand-scan-ui';
import type { InsightItem } from '../../apps/web/src/lib/brand-types';

const insight = (id: string, field: string, text: string): InsightItem => ({
  id,
  field_key: field,
  text_value: text,
  info_state: 'OBSERVED',
  review_status: 'ACCEPTED',
  discovery_tier: 'SUPPORTING',
  evidence_id: id,
  value_json: null,
  row_version: 1,
});

describe('brand-scan-ui', () => {
  it('groups duplicate field values', () => {
    const groups = groupInsightsByFieldAndValue([
      insight('1', 'brand.name', 'VELVET'),
      insight('2', 'brand.name', 'VELVET'),
      insight('3', 'brand.description', 'Desc'),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.duplicates).toHaveLength(1);
  });

  it('detects likely SPA shells from page titles', () => {
    const pages = Array.from({ length: 8 }, () => ({ title: 'Same title' }));
    expect(likelySpaShell(pages)).toBe(true);
    expect(likelySpaShell([{ title: 'A' }, { title: 'B' }, { title: 'C' }])).toBe(false);
  });
});
