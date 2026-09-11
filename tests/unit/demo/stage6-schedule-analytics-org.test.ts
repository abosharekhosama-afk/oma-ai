import { describe, expect, it } from 'vitest';
import { DEMO_GRAPH, DemoDataProvider, computeScheduleReadiness } from '@oma/demo';
import {
  EMPTY_SCHEDULE_FILTERS,
  filterSchedule,
  internalReady,
  isValidPlannedAt,
  readinessScore,
  weekDays,
} from '../../../apps/web/src/lib/demo/stage6-schedule';
import {
  kpiDeltaTone,
  percentDelta,
  safeDivide,
  sparklinePoints,
} from '../../../apps/web/src/lib/demo/stage6-analytics';
import {
  capacityState,
  commandCenterScheduleCounts,
  filterActivity,
  filterTeam,
  EMPTY_ACTIVITY_FILTERS,
  EMPTY_TEAM_FILTERS,
} from '../../../apps/web/src/lib/demo/stage6-team';

describe('demo graph reset', () => {
  it('restores seed after mutating schedule preferences', () => {
    const provider = new DemoDataProvider();
    const id = provider.getGraph().scheduledPosts[0]!.id;
    provider.updateScheduledPost(id, { plannedAt: '2026-09-20T12:00:00+03:00' });
    provider.updateDemoPreferences({ timezone: 'UTC', weekStart: 'sunday' });
    expect(provider.getGraph().demoPreferences.timezone).toBe('UTC');
    provider.reset();
    expect(provider.getGraph().scheduledPosts[0]!.plannedAt).toBe(
      DEMO_GRAPH.scheduledPosts[0]!.plannedAt,
    );
    expect(provider.getDemoPreferences().timezone).toBe(DEMO_GRAPH.demoPreferences.timezone);
    expect(provider.getDemoPreferences().weekStart).toBe(DEMO_GRAPH.demoPreferences.weekStart);
  });
});

describe('stage6 schedule helpers', () => {
  it('filters readiness and builds week days', () => {
    const ready = filterSchedule(
      DEMO_GRAPH.scheduledPosts,
      { ...EMPTY_SCHEDULE_FILTERS, readiness: 'ready' },
      'en',
    );
    expect(ready.every((r) => internalReady(r))).toBe(true);
    expect(weekDays('2026-09-11')).toHaveLength(7);
    expect(isValidPlannedAt('2026-09-12T09:00:00+03:00')).toBe(true);
    expect(isValidPlannedAt('')).toBe(false);
  });

  it('scores readiness excluding integration blockers from internal ready', () => {
    const post = DEMO_GRAPH.scheduledPosts.find((p) => p.id === 'demo-sched-1')!;
    const score = readinessScore(post);
    expect(score.total).toBeGreaterThan(0);
    const computed = computeScheduleReadiness(post, DEMO_GRAPH);
    expect(computed.some((c) => c.kind === 'integration' && !c.ok)).toBe(true);
  });
});

describe('stage6 analytics helpers', () => {
  it('handles deltas, divide-by-zero, and sparkline', () => {
    expect(safeDivide(10, 0)).toBe(0);
    expect(percentDelta(110, 100)).toBe(10);
    expect(percentDelta(5, 0)).toBe(100);
    expect(kpiDeltaTone(10, true)).toBe('positive');
    expect(kpiDeltaTone(10, false)).toBe('negative');
    const spark = sparklinePoints([10, 20, 15]);
    expect(spark.points.split(' ')).toHaveLength(3);
  });
});

describe('stage6 team/activity helpers', () => {
  it('classifies capacity and filters team/activity', () => {
    expect(capacityState(0.2)).toBe('available');
    expect(capacityState(0.6)).toBe('balanced');
    expect(capacityState(0.85)).toBe('at_risk');
    expect(capacityState(0.95)).toBe('over_capacity');
    const atRisk = filterTeam(
      DEMO_GRAPH.members,
      { ...EMPTY_TEAM_FILTERS, capacity: 'at_risk' },
      'en',
    );
    expect(atRisk.every((m) => capacityState(m.workload) === 'at_risk')).toBe(true);
    const demoOnly = filterActivity(
      DEMO_GRAPH.activity,
      { ...EMPTY_ACTIVITY_FILTERS, source: 'DEMO' },
      'en',
    );
    expect(demoOnly.every((a) => a.source === 'DEMO')).toBe(true);
    expect(commandCenterScheduleCounts(DEMO_GRAPH.scheduledPosts).thisWeek).toBeGreaterThan(0);
  });
});

describe('stage6 demo provider mutations', () => {
  it('reschedules with persistence and preference updates', () => {
    const provider = new DemoDataProvider();
    const id = 'demo-sched-1';
    const updated = provider.updateScheduledPost(id, {
      plannedAt: '2026-09-15T10:30:00+03:00',
      channels: ['Instagram'],
      state: 'SCHEDULED_PREVIEW',
    });
    expect(updated?.plannedAt).toContain('2026-09-15');
    expect(updated?.externalPublishingConnected).toBe(false);
    expect(provider.getScheduledPost(id)?.plannedAt).toContain('2026-09-15');

    const prefs = provider.updateDemoPreferences({
      timezone: 'Asia/Riyadh',
      weekStart: 'sunday',
      reviewReminders: false,
    });
    expect(prefs.timezone).toBe('Asia/Riyadh');
    expect(provider.getDemoPreferences().weekStart).toBe('sunday');
  });
});
