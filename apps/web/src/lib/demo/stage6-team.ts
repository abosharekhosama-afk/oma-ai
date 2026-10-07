import type { DemoGraph } from '@oma/demo';

export type TeamMember = DemoGraph['members'][number];
export type ActivityRow = DemoGraph['activity'][number];

export type CapacityState = 'available' | 'balanced' | 'at_risk' | 'over_capacity';

/** Deterministic capacity thresholds from Demo workload (not real hours). */
export function capacityState(workload: number): CapacityState {
  if (workload < 0.45) return 'available';
  if (workload < 0.75) return 'balanced';
  if (workload < 0.9) return 'at_risk';
  return 'over_capacity';
}

export type TeamFilters = {
  q: string;
  role: string;
  capacity: 'all' | CapacityState;
  restricted: 'all' | 'yes' | 'no';
};

export const EMPTY_TEAM_FILTERS: TeamFilters = {
  q: '',
  role: 'all',
  capacity: 'all',
  restricted: 'all',
};

export function filterTeam(
  rows: TeamMember[],
  filters: TeamFilters,
  locale: 'en' | 'ar',
): TeamMember[] {
  const q = filters.q.trim().toLowerCase();
  return rows.filter((m) => {
    if (filters.role !== 'all' && m.role !== filters.role) return false;
    if (filters.restricted === 'yes' && !m.restricted) return false;
    if (filters.restricted === 'no' && m.restricted) return false;
    if (filters.capacity !== 'all' && capacityState(m.workload) !== filters.capacity) return false;
    if (!q) return true;
    const hay = `${m.name[locale]} ${m.name.en} ${m.role} ${m.assigneeKey}`.toLowerCase();
    return hay.includes(q);
  });
}

export type ActivityFilters = {
  q: string;
  source: 'all' | 'DEMO' | 'FOUNDATION';
  objectType: string;
  actor: string;
};

export const EMPTY_ACTIVITY_FILTERS: ActivityFilters = {
  q: '',
  source: 'all',
  objectType: 'all',
  actor: 'all',
};

export function filterActivity(
  rows: ActivityRow[],
  filters: ActivityFilters,
  locale: 'en' | 'ar',
): ActivityRow[] {
  const q = filters.q.trim().toLowerCase();
  return rows.filter((a) => {
    if (filters.source !== 'all' && a.source !== filters.source) return false;
    if (filters.objectType !== 'all' && a.objectType !== filters.objectType) return false;
    if (filters.actor !== 'all' && a.actor !== filters.actor) return false;
    if (!q) return true;
    const hay =
      `${a.actor} ${a.summary[locale]} ${a.summary.en} ${a.action} ${a.objectType}`.toLowerCase();
    return hay.includes(q);
  });
}

export function groupActivityByDay(rows: ActivityRow[]): Map<string, ActivityRow[]> {
  const map = new Map<string, ActivityRow[]>();
  for (const row of [...rows].sort((a, b) => b.at.localeCompare(a.at))) {
    const key = row.at.slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

export function commandCenterScheduleCounts(posts: DemoGraph['scheduledPosts']) {
  // Demo “today” window aligned with Content Plan golden cursor (Oct 2026).
  const today = '2026-10-05';
  const weekEnd = '2026-10-11';
  const thisWeek = posts.filter((p) => {
    const d = p.plannedAt.slice(0, 10);
    return d >= today && d <= weekEnd;
  }).length;
  const ready = posts.filter((p) => p.state === 'READY' || p.state === 'SCHEDULED_PREVIEW').length;
  return { thisWeek, ready };
}
