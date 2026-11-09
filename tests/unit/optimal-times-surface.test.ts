import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('optimal send times surfaces', () => {
  it('registers Prisma models and the nightly worker job', () => {
    const schema = read('packages/db/prisma/schema.prisma');
    expect(schema).toContain('model PostMetricSnapshot');
    expect(schema).toContain('model AudienceActivityBucket');
    expect(schema).toContain('model OptimalTimeSlot');
    const jobs = read('apps/worker/src/social/social-jobs.ts');
    expect(jobs).toContain('runOptimalTimesTick');
    expect(read('apps/worker/src/social/fetch-insights.ts')).toContain('upsertPostMetricSnapshot');
  });

  it('exposes heatmap, list, and suggest APIs with the documented capabilities', () => {
    const controller = read('apps/api/src/analytics/analytics.controller.ts');
    expect(controller).toContain("@Get('optimal-times')");
    expect(controller).toContain("@Get('optimal-times/heatmap')");
    expect(controller).toContain("@Get('optimal-times/suggest')");
    expect(controller).toContain("@RequireCapabilities('analytics.read')");
    expect(controller).toContain("@RequireCapabilities('content.schedule')");
    const guard = read('apps/api/src/common/guards/capabilities.guard.ts');
    expect(guard).toContain("'GET /api/v1/analytics/optimal-times': ['analytics.read']");
    expect(guard).toContain("'GET /api/v1/analytics/optimal-times/heatmap': ['analytics.read']");
    expect(guard).toContain("'GET /api/v1/analytics/optimal-times/suggest': ['content.schedule']");
    expect(controller).toContain("assertFeature(tenantId, 'analytics')");
  });

  it('adds the analytics heatmap page and composer suggestion chip', () => {
    expect(read('apps/web/src/components/shell/nav-config.ts')).toContain(
      '/app/analytics/optimal-times',
    );
    const page = read(
      'apps/web/src/app/(app)/app/analytics/optimal-times/optimal-times-client.tsx',
    );
    expect(page).toContain('data-testid="analytics-optimal-times"');
    expect(page).toContain('data-testid="optimal-times-heatmap"');
    const chip = read('apps/web/src/components/content/best-time-suggestions.tsx');
    expect(chip).toContain('getOptimalTimeSuggestions');
    const compose = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    expect(compose).toContain('<BestTimeSuggestions');
  });
});
