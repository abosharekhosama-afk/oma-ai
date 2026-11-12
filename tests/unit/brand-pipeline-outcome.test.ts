import { describe, expect, it } from 'vitest';
import { buildBrandPipelineStages } from '../../apps/web/src/lib/brand-pipeline-outcome';
import type { BrandDetail, ScanDetail } from '../../apps/web/src/lib/brand-types';

const t = (k: string) => k;

const baseBrand = {
  id: 'b1',
  name: 'Test',
  website: { normalized_url: 'https://example.com' },
  latest_scan: { id: 's1', status: 'PARTIAL' },
} as unknown as BrandDetail;

describe('buildBrandPipelineStages', () => {
  it('marks discovery current after partial scan', () => {
    const scan = {
      id: 's1',
      status: 'PARTIAL',
      pages_fetched: 12,
      discovery_summary: { pages: 12, products: 3, services: 1 },
    } as ScanDetail;
    const stages = buildBrandPipelineStages('b1', baseBrand, scan, t);
    const discovery = stages.find((s) => s.id === 'discovery');
    expect(discovery?.state).toBe('current');
  });
});
