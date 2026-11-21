import { describe, expect, it } from 'vitest';
import {
  buildBrandPipelineStages,
  pipelineEndGoal,
} from '../../apps/web/src/lib/brand-pipeline-outcome';
import type { BrandDetail, ScanDetail } from '../../apps/web/src/lib/brand-types';

const t = (k: string) => k;

const strategyBrand = {
  id: 'b1',
  name: 'Test',
  website: { normalized_url: 'https://example.com' },
  latest_scan: { id: 's1', status: 'PARTIAL' },
  current_approved_profile_version_id: 'p1',
  current_approved_strategy_id: 'st1',
} as unknown as BrandDetail;

describe('buildBrandPipelineStages', () => {
  it('marks discovery current after partial scan', () => {
    const brand = {
      id: 'b1',
      name: 'Test',
      website: { normalized_url: 'https://example.com' },
      latest_scan: { id: 's1', status: 'PARTIAL' },
    } as unknown as BrandDetail;
    const scan = {
      id: 's1',
      status: 'PARTIAL',
      pages_fetched: 12,
      discovery_summary: { pages: 12, products: 3, services: 1 },
    } as ScanDetail;
    const stages = buildBrandPipelineStages('b1', brand, scan, t);
    const discovery = stages.find((s) => s.id === 'discovery');
    expect(discovery?.state).toBe('current');
  });

  it('marks plan_requests current when strategy approved and no requests', () => {
    const scan = {
      id: 's1',
      status: 'SUCCEEDED',
      pages_fetched: 5,
    } as ScanDetail;
    const stages = buildBrandPipelineStages('b1', strategyBrand, scan, t, {
      work_request_count: 0,
      content_count: 0,
    });
    expect(stages.find((s) => s.id === 'plan_requests')?.state).toBe('current');
    expect(stages.find((s) => s.id === 'content')?.state).toBe('todo');
  });

  it('marks content current when requests exist and no content', () => {
    const stages = buildBrandPipelineStages('b1', strategyBrand, null, t, {
      work_request_count: 2,
      content_count: 0,
    });
    expect(stages.find((s) => s.id === 'plan_requests')?.state).toBe('done');
    expect(stages.find((s) => s.id === 'content')?.state).toBe('current');
    expect(stages.find((s) => s.id === 'plan_requests')?.href).toContain('/review');
  });
});

describe('pipelineEndGoal', () => {
  it('suggests plan requests after strategy', () => {
    expect(pipelineEndGoal(t, strategyBrand, { work_request_count: 0, content_count: 0 })).toBe(
      'brand.pipeline.endGoalPlanRequests',
    );
  });
});
