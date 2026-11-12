import { describe, expect, it } from 'vitest';
import { brandPrimaryNextStep, buildBrandJourneySteps } from '../../apps/web/src/lib/brand-journey';
import type { BrandDetail } from '../../apps/web/src/lib/brand-types';

const t = (key: string) => key;

function baseBrand(overrides: Partial<BrandDetail> = {}): BrandDetail {
  return {
    id: 'b1',
    name: 'Test',
    status: 'ACTIVE',
    version: 1,
    current_approved_profile_version_id: null,
    current_approved_strategy_id: null,
    website: null,
    latest_scan: null,
    next_scan_connector_mode: 'LIVE',
    archived_at: null,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('buildBrandJourneySteps', () => {
  it('marks strategy as current when profile approved but no current strategy', () => {
    const steps = buildBrandJourneySteps(
      baseBrand({
        website: {
          website_source_id: 'w',
          normalized_url: 'https://ex.test',
          validation_status: 'VALID',
          source_revision: 1,
        },
        latest_scan: { id: 's1', status: 'PARTIAL', job_run_id: 'j', connector_mode: 'LIVE' },
        current_approved_profile_version_id: 'p1',
      }),
      t,
    );
    const strategy = steps.find((s) => s.id === 'strategy');
    expect(strategy?.state).toBe('current');
  });

  it('marks strategy done when current strategy pointer set', () => {
    const steps = buildBrandJourneySteps(
      baseBrand({
        current_approved_profile_version_id: 'p1',
        current_approved_strategy_id: 'st1',
        latest_scan: { id: 's1', status: 'SUCCEEDED', job_run_id: 'j', connector_mode: 'LIVE' },
      }),
      t,
    );
    expect(steps.find((s) => s.id === 'strategy')?.state).toBe('done');
  });
});

describe('brandPrimaryNextStep', () => {
  it('suggests create strategy when profile approved', () => {
    const next = brandPrimaryNextStep(
      'b1',
      baseBrand({
        website: {
          website_source_id: 'w',
          normalized_url: 'https://ex.test',
          validation_status: 'VALID',
          source_revision: 1,
        },
        latest_scan: { id: 's1', status: 'PARTIAL', job_run_id: 'j', connector_mode: 'LIVE' },
        current_approved_profile_version_id: 'p1',
      }),
      t,
    );
    expect(next.href).toBe('/app/brands/b1/strategies/new');
    expect(next.label).toBe('brand.detail.createStrategyCta');
  });

  it('opens current strategy when pointer set', () => {
    const next = brandPrimaryNextStep(
      'b1',
      baseBrand({
        website: {
          website_source_id: 'w',
          normalized_url: 'https://ex.test',
          validation_status: 'VALID',
          source_revision: 1,
        },
        latest_scan: { id: 's1', status: 'PARTIAL', job_run_id: 'j', connector_mode: 'LIVE' },
        current_approved_profile_version_id: 'p1',
        current_approved_strategy_id: 'st9',
      }),
      t,
    );
    expect(next.href).toBe('/app/brands/b1/strategies/st9');
  });
});
