import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  EMPTY_ANALYTICS_FILTERS,
  filterSeries,
  filterChannels,
  kpiDeltaTone,
  organicPaidComparison,
  percentDelta,
  sparklinePoints,
} from '../../apps/web/src/lib/demo/stage6-analytics';
import {
  EMPTY_ACTIVITY_FILTERS,
  EMPTY_TEAM_FILTERS,
  capacityState,
  filterActivity,
  filterTeam,
} from '../../apps/web/src/lib/demo/stage6-team';
import { DEMO_GRAPH } from '../../packages/demo/src/index';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

const ALIAS_RE =
  /--oma-violet|--oma-signal(?:-soft)?|--motion-micro|--motion-panel|--motion-ease|--shell-top-height|#6658[Ee]8|#121419/;

describe('P6 Planable analytics/organization/settings surfaces', () => {
  it('rebuilds stage6 CSS without legacy aliases or purple palette', () => {
    const css = read('apps/web/src/styles/stage6.css');
    expect(css).toContain('--oma-primary');
    expect(css).toContain('--shell-header-height');
    expect(css).toContain('.oma-settings-layout');
    expect(css).toContain('.oma-chart-legend');
    expect(css).not.toMatch(ALIAS_RE);
    expect(css).not.toMatch(/\bInter\b|IBM Plex/i);
  });

  it('removes all P1_COMPAT alias definitions from tokens.css', () => {
    const tokens = read('packages/ui/src/tokens.css');
    expect(tokens).toContain('--oma-primary: #1677ff');
    expect(tokens).toContain('--shell-header-height');
    expect(tokens).not.toContain('--oma-violet');
    expect(tokens).not.toContain('--oma-signal');
    expect(tokens).not.toContain('--oma-signal-soft');
    expect(tokens).not.toContain('--motion-micro');
    expect(tokens).not.toContain('--motion-panel');
    expect(tokens).not.toContain('--motion-ease');
    expect(tokens).not.toContain('--shell-top-height');
    expect(tokens).not.toContain('P1_COMPAT');
  });

  it('scans runtime product CSS/TSX for zero legacy contamination', () => {
    const roots = [
      'packages/ui/src',
      'apps/web/src/styles',
      'apps/web/src/app',
      'apps/web/src/components',
    ];
    const hits: string[] = [];
    for (const dir of roots) {
      const walk = (d: string) => {
        for (const ent of readdirSync(join(root, d), { withFileTypes: true })) {
          const rel = join(d, ent.name);
          if (ent.isDirectory()) {
            if (ent.name === 'node_modules' || ent.name === '.next') continue;
            walk(rel);
            continue;
          }
          if (!/\.(css|tsx|ts)$/.test(ent.name)) continue;
          if (ent.name.endsWith('.test.ts') || ent.name.endsWith('.spec.ts')) continue;
          const text = read(rel);
          if (ALIAS_RE.test(text)) hits.push(rel);
        }
      };
      walk(dir);
    }
    expect(hits).toEqual([]);
  });

  it('computes KPI semantic direction (higher is not always good)', () => {
    expect(kpiDeltaTone(10, true)).toBe('positive');
    expect(kpiDeltaTone(-10, true)).toBe('negative');
    expect(kpiDeltaTone(10, false)).toBe('negative');
    expect(kpiDeltaTone(-10, false)).toBe('positive');
    expect(percentDelta(110, 100)).toBe(10);
  });

  it('filters analytics series/channels and keeps chart/table values consistent', () => {
    const data = DEMO_GRAPH.analytics;
    const filtered = filterSeries(data, { ...EMPTY_ANALYTICS_FILTERS, track: 'ORGANIC' });
    expect(filtered.every((p) => p.track === 'ORGANIC')).toBe(true);
    const channels = filterChannels(data, { ...EMPTY_ANALYTICS_FILTERS, track: 'PAID' });
    expect(channels.every((c) => c.track === 'PAID')).toBe(true);
    const spark = sparklinePoints(filtered.map((p) => p.impressions));
    expect(spark.points.split(' ').length).toBe(filtered.length);
    const cmp = organicPaidComparison(data);
    expect(cmp.organic.impressions + cmp.paid.impressions).toBeGreaterThan(0);
  });

  it('derives team capacity from demo workload only', () => {
    expect(capacityState(0.2)).toBe('available');
    expect(capacityState(0.55)).toBe('balanced');
    expect(capacityState(0.85)).toBe('at_risk');
    expect(capacityState(1.1)).toBe('over_capacity');
    const team = filterTeam(
      DEMO_GRAPH.members,
      { ...EMPTY_TEAM_FILTERS, capacity: 'at_risk' },
      'en',
    );
    expect(team.every((m) => capacityState(m.workload) === 'at_risk')).toBe(true);
  });

  it('separates DEMO vs FOUNDATION activity source labels', () => {
    const demo = filterActivity(
      DEMO_GRAPH.activity,
      { ...EMPTY_ACTIVITY_FILTERS, source: 'DEMO' },
      'en',
    );
    const foundation = filterActivity(
      DEMO_GRAPH.activity,
      { ...EMPTY_ACTIVITY_FILTERS, source: 'FOUNDATION' },
      'en',
    );
    expect(demo.every((a) => a.source === 'DEMO')).toBe(true);
    expect(foundation.every((a) => a.source === 'FOUNDATION')).toBe(true);
  });

  it('keeps analytics/settings honesty markers in surface source', () => {
    const analytics = read('apps/web/src/app/(app)/app/analytics/page.tsx');
    expect(analytics).toContain('demo-analytics-honesty');
    expect(analytics).toContain('demo-analytics-sample-badge');
    expect(analytics).toContain('stroke="var(--oma-primary)"');
    expect(analytics).toContain('strokeDasharray');
    expect(analytics).not.toContain('--oma-violet');
    const settings = read('apps/web/src/app/(app)/app/settings/page.tsx');
    expect(settings).toContain('demo.settings.noConnect');
    expect(settings).toContain('demo-integrations-search');
    expect(settings).toContain('demo-settings-dirty');
    expect(settings).not.toMatch(/oauth|api[_-]?key|Connect account/i);
  });

  it('documents final zero-alias inventory', () => {
    const inventory = read('docs/FINAL_COMPATIBILITY_INVENTORY.md');
    expect(inventory).toMatch(/Runtime alias definitions\s*=\s*0/i);
    expect(inventory).toMatch(/Runtime alias usages\s*=\s*0/i);
    const compat = read('docs/PLANABLE_P1_COMPAT_INVENTORY.md');
    expect(compat).toMatch(/P6/);
    expect(compat).toMatch(/CLOSED|Deleted/i);
    expect(compat).toContain('removed from stage2.css in P2');
  });
});
