/**
 * Production Campaign API client + adapters to the stage3 CampaignRow shape.
 */
import { api } from './api';
import { scopeBrands } from './active-brand';
import type { CampaignRow } from './demo/stage3-campaigns';

export type ApiLocale = { en: string; ar: string };

export type ApiCampaign = {
  id: string;
  tenant_id: string;
  brand_id: string;
  name: ApiLocale;
  description: ApiLocale | null;
  objective?: ApiLocale | null;
  audience?: ApiLocale | null;
  channels?: string[];
  strategy_id?: string | null;
  budget?: { amount: number; currency: string; planning_only?: boolean } | null;
  track: 'ORGANIC' | 'PAID';
  status: CampaignRow['status'];
  timeline: { start: string; end: string };
  owner_user_id: string | null;
  links: string[];
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  content_count: number;
  review_hint: string;
};

export type ApiBrandListItem = {
  id: string;
  name: string;
  status: string;
};

/** Map production campaign → UI CampaignRow (demo-compatible). */
export function toCampaignRow(c: ApiCampaign, ownerLabel?: string): CampaignRow {
  return {
    id: c.id,
    brandId: c.brand_id,
    strategyId: c.strategy_id ?? '',
    name: c.name,
    track: c.track,
    status: c.status,
    objective: c.objective ?? c.description ?? { en: '', ar: '' },
    audience: c.audience ?? { en: '', ar: '' },
    channels: c.channels ?? [],
    links: c.links ?? [],
    timeline: c.timeline,
    budget: {
      amount: c.budget?.amount ?? 0,
      currency: c.budget?.currency ?? 'USD',
      planningOnly: true as const,
    },
    owner: ownerLabel || c.owner_user_id || '—',
    kpis: [],
  };
}

export async function listBrandsProduction(): Promise<ApiBrandListItem[]> {
  const res = await api<{ data: ApiBrandListItem[] }>('/api/v1/brands?limit=100');
  return res.data ?? [];
}

/** Brands visible on work surfaces: only the active brand when one is selected. */
export async function listScopedBrands(): Promise<ApiBrandListItem[]> {
  return scopeBrands(await listBrandsProduction());
}

export async function listCampaignsForBrand(
  brandId: string,
  query?: { status?: string; track?: string; q?: string; includeArchived?: boolean },
): Promise<ApiCampaign[]> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.track) params.set('track', query.track);
  if (query?.q) params.set('q', query.q);
  if (query?.includeArchived) params.set('includeArchived', 'true');
  params.set('limit', '100');
  const qs = params.toString();
  const res = await api<{ data: ApiCampaign[] }>(
    `/api/v1/brands/${brandId}/campaigns${qs ? `?${qs}` : ''}`,
  );
  return res.data ?? [];
}

export async function listAllCampaigns(
  brandIds: string[],
  query?: { status?: string; track?: string; q?: string },
): Promise<ApiCampaign[]> {
  const batches = await Promise.all(
    brandIds.map((id) => listCampaignsForBrand(id, query).catch(() => [] as ApiCampaign[])),
  );
  return batches.flat();
}

export async function createCampaignProduction(input: {
  brandId: string;
  name: ApiLocale | string;
  description?: ApiLocale | string;
  objective?: ApiLocale | string;
  audience?: ApiLocale | string;
  channels?: string[];
  strategyId?: string | null;
  track: 'ORGANIC' | 'PAID';
  timelineStart: string;
  timelineEnd: string;
  links?: string[];
  status?: string;
}): Promise<ApiCampaign> {
  const { brandId, ...body } = input;
  const res = await api<{ data: ApiCampaign }>(`/api/v1/brands/${brandId}/campaigns`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function updateCampaignProduction(
  campaignId: string,
  patch: Record<string, unknown>,
): Promise<ApiCampaign> {
  const res = await api<{ data: ApiCampaign }>(`/api/v1/campaigns/${campaignId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.data;
}

export async function archiveCampaignProduction(campaignId: string): Promise<ApiCampaign> {
  const res = await api<{ data: ApiCampaign }>(`/api/v1/campaigns/${campaignId}/archive`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return res.data;
}

export async function getCampaignProduction(campaignId: string): Promise<ApiCampaign> {
  const res = await api<{ data: ApiCampaign }>(`/api/v1/campaigns/${campaignId}`);
  return res.data;
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const e = err as {
      message?: string;
      status?: number;
      data?: { error?: { message?: string; code?: string; message_key?: string } };
    };
    const domainMsg = e.data?.error?.message;
    if (domainMsg) {
      const code = e.data?.error?.code;
      if (code === 'PERMISSION_DENIED') {
        return `${domainMsg} (missing campaign/content capability — re-run seed)`;
      }
      if (code === 'NOT_FOUND') {
        return domainMsg;
      }
      return domainMsg;
    }
    if (e.message && e.message !== 'Not Found' && e.message !== 'Forbidden') return e.message;
    if (e.status === 403) return 'Permission denied (campaign capability required)';
    if (e.status === 404) return 'Not found — ensure migration is applied and brand exists';
    if (e.status === 500) return 'Server error — check Campaign table migration / prisma generate';
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function isForbidden(err: unknown): boolean {
  return Boolean(
    err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 403,
  );
}
