import type { DemoGraph } from '@oma/demo';

export type CampaignRow = DemoGraph['campaigns'][number];
export type ContentRow = DemoGraph['contentItems'][number];
export type StrategyRow = DemoGraph['strategies'][number];

export type CampaignFilters = {
  query: string;
  brandId: string;
  status: string;
  track: string;
  strategyId: string;
  owner: string;
  startFrom: string;
  endTo: string;
};

export const EMPTY_CAMPAIGN_FILTERS: CampaignFilters = {
  query: '',
  brandId: 'all',
  status: 'all',
  track: 'all',
  strategyId: 'all',
  owner: 'all',
  startFrom: '',
  endTo: '',
};

export function campaignProgress(campaign: CampaignRow): number {
  if (!campaign.kpis.length) return 0;
  const sum = campaign.kpis.reduce((acc, kpi) => acc + kpi.progress, 0);
  return Math.round((sum / campaign.kpis.length) * 100);
}

export function campaignReviewState(items: ContentRow[]): string {
  if (items.some((i) => i.status === 'IN_REVIEW')) return 'IN_REVIEW';
  if (items.some((i) => i.status === 'DRAFT')) return 'DRAFT';
  if (items.some((i) => i.status === 'APPROVED')) return 'APPROVED';
  if (items.some((i) => i.status === 'SCHEDULED')) return 'SCHEDULED';
  if (items.some((i) => i.status === 'PUBLISHED_DEMO')) return 'PUBLISHED_DEMO';
  return 'CLEAR';
}

export function campaignScheduleReadiness(items: ContentRow[]): 'ready' | 'drafts' | 'blocked' {
  if (items.some((i) => i.status === 'IN_REVIEW')) return 'blocked';
  if (items.some((i) => i.status === 'DRAFT')) return 'drafts';
  if (items.length === 0) return 'drafts';
  return 'ready';
}

export function campaignNextAction(
  campaign: CampaignRow,
  items: ContentRow[],
  locale: string,
): string {
  const ar = locale.toLowerCase().startsWith('ar');
  if (campaign.status === 'NEEDS_ATTENTION') {
    return ar ? 'فك اختناق المراجعة' : 'Clear review bottleneck';
  }
  if (campaign.status === 'DRAFT') {
    return ar ? 'أكمل إعداد الحملة' : 'Finish campaign setup';
  }
  if (items.some((i) => i.status === 'IN_REVIEW')) {
    return ar ? 'راجع المحتوى المعلق' : 'Review pending content';
  }
  if (campaign.status === 'UPCOMING') {
    return ar ? 'جهّز أصول الإطلاق' : 'Prepare launch assets';
  }
  if (campaign.status === 'COMPLETED' || campaign.status === 'ARCHIVED') {
    return ar ? 'أرشيف — لا إجراء' : 'Archived — no action';
  }
  if (items.some((i) => i.status === 'DRAFT')) {
    return ar ? 'أنهِ المسودات' : 'Complete drafts';
  }
  return ar ? 'راقب الجدول' : 'Monitor schedule';
}

export function filterCampaigns(
  campaigns: CampaignRow[],
  filters: CampaignFilters,
  locale: string,
): CampaignRow[] {
  const q = filters.query.trim().toLowerCase();
  return campaigns.filter((c) => {
    if (filters.brandId !== 'all' && c.brandId !== filters.brandId) return false;
    if (filters.status !== 'all' && c.status !== filters.status) return false;
    if (filters.track !== 'all' && c.track !== filters.track) return false;
    if (filters.strategyId !== 'all' && c.strategyId !== filters.strategyId) return false;
    if (filters.owner !== 'all' && c.owner !== filters.owner) return false;
    if (filters.startFrom && c.timeline.end < filters.startFrom) return false;
    if (filters.endTo && c.timeline.start > filters.endTo) return false;
    if (q) {
      const name = locale.toLowerCase().startsWith('ar') ? c.name.ar : c.name.en;
      const hay = `${name} ${c.owner} ${c.track} ${c.status}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

const STATUS_GROUP_ORDER = [
  'NEEDS_ATTENTION',
  'ACTIVE',
  'IN_REVIEW',
  'UPCOMING',
  'DRAFT',
  'COMPLETED',
  'ARCHIVED',
] as const;

export function groupCampaignsByStatus(campaigns: CampaignRow[]): Array<{
  status: string;
  rows: CampaignRow[];
}> {
  const map = new Map<string, CampaignRow[]>();
  for (const c of campaigns) {
    const list = map.get(c.status) ?? [];
    list.push(c);
    map.set(c.status, list);
  }
  const groups: Array<{ status: string; rows: CampaignRow[] }> = [];
  for (const status of STATUS_GROUP_ORDER) {
    const rows = map.get(status);
    if (rows?.length) groups.push({ status, rows });
  }
  for (const [status, rows] of map) {
    if (!STATUS_GROUP_ORDER.includes(status as (typeof STATUS_GROUP_ORDER)[number])) {
      groups.push({ status, rows });
    }
  }
  return groups;
}

export function strategyHref(brandId: string, strategyId: string): string {
  return `/app/brands/${brandId}/strategies/${strategyId}`;
}

export function activeFilterCount(filters: CampaignFilters): number {
  let n = 0;
  if (filters.query.trim()) n += 1;
  if (filters.brandId !== 'all') n += 1;
  if (filters.status !== 'all') n += 1;
  if (filters.track !== 'all') n += 1;
  if (filters.strategyId !== 'all') n += 1;
  if (filters.owner !== 'all') n += 1;
  if (filters.startFrom) n += 1;
  if (filters.endTo) n += 1;
  return n;
}

export type NamedFilterChip = { id: string; label: string };

export function campaignFilterChips(
  filters: CampaignFilters,
  labels: {
    brand: (id: string) => string;
    status: (id: string) => string;
    track: (id: string) => string;
    strategy: (id: string) => string;
  },
): NamedFilterChip[] {
  const chips: NamedFilterChip[] = [];
  if (filters.query.trim()) chips.push({ id: 'query', label: filters.query.trim() });
  if (filters.brandId !== 'all')
    chips.push({ id: 'brandId', label: labels.brand(filters.brandId) });
  if (filters.status !== 'all') chips.push({ id: 'status', label: labels.status(filters.status) });
  if (filters.track !== 'all') chips.push({ id: 'track', label: labels.track(filters.track) });
  if (filters.strategyId !== 'all') {
    chips.push({ id: 'strategyId', label: labels.strategy(filters.strategyId) });
  }
  if (filters.owner !== 'all') chips.push({ id: 'owner', label: filters.owner });
  if (filters.startFrom) chips.push({ id: 'startFrom', label: filters.startFrom });
  if (filters.endTo) chips.push({ id: 'endTo', label: filters.endTo });
  return chips;
}

export function clearCampaignChip(filters: CampaignFilters, id: string): CampaignFilters {
  if (id === 'query') return { ...filters, query: '' };
  if (id === 'brandId') return { ...filters, brandId: 'all' };
  if (id === 'status') return { ...filters, status: 'all' };
  if (id === 'track') return { ...filters, track: 'all' };
  if (id === 'strategyId') return { ...filters, strategyId: 'all' };
  if (id === 'owner') return { ...filters, owner: 'all' };
  if (id === 'startFrom') return { ...filters, startFrom: '' };
  if (id === 'endTo') return { ...filters, endTo: '' };
  return filters;
}
