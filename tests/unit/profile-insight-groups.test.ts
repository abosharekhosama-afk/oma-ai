import { describe, expect, it } from 'vitest';
import { groupInsightsByEvidence, bundleTitle } from '../../apps/web/src/lib/profile-insight-groups';
import type { InsightItem } from '../../apps/web/src/lib/brand-types';

function row(partial: Partial<InsightItem> & Pick<InsightItem, 'id' | 'field_key'>): InsightItem {
  return {
    text_value: null,
    info_state: 'OBSERVED',
    review_status: 'PENDING',
    discovery_tier: 'REQUIRED_FOR_APPROVAL',
    evidence_id: 'ev-1',
    value_json: null,
    row_version: 1,
    reference_class: 'Fact',
    ...partial,
  };
}

describe('groupInsightsByEvidence', () => {
  it('bundles per-page brand fields by shared evidence id', () => {
    const insights = [
      row({ id: '1', field_key: 'brand.name', text_value: 'Widget A', evidence_id: 'e1' }),
      row({ id: '2', field_key: 'brand.source_url', text_value: 'https://a.test/p1', evidence_id: 'e1' }),
      row({ id: '3', field_key: 'brand.name', text_value: 'Widget B', evidence_id: 'e2' }),
      row({ id: '4', field_key: 'brand.logo', text_value: '{}', evidence_id: 'e2' }),
    ];
    const { bundles, singletons } = groupInsightsByEvidence(insights);
    expect(bundles).toHaveLength(2);
    expect(singletons).toHaveLength(0);
    expect(bundleTitle(bundles[0]!.insights)).toBeTruthy();
  });
});