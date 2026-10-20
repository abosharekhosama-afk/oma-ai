/**
 * Production Content API client + adapter to stage3 ContentRow shape.
 */
import { api } from './api';
import type { ContentRow } from './demo/stage3-campaigns';
import type { ApiLocale } from './campaign-api';
import { listBrandsProduction, listAllCampaigns, toCampaignRow } from './campaign-api';
import type { CampaignRow } from './demo/stage3-campaigns';

export type ApiContentWorkflow = {
  plannedAt: string | null;
  scheduleState: 'UNSCHEDULED' | 'SCHEDULED';
  approvalState: string;
  policy: 'NONE' | 'OPTIONAL' | 'REQUIRED';
  approverApproved: number;
  approverRequired: number;
  scheduleBlocked: boolean;
  publishDisplay: string;
  publishingConnected: false;
};

export type ApiContent = {
  id: string;
  tenant_id: string;
  brand_id: string;
  campaign_id: string | null;
  title: ApiLocale;
  caption: ApiLocale | null;
  content_type: ContentRow['contentType'];
  channel: string;
  track: ContentRow['track'];
  status: ContentRow['status'];
  approval_state: string;
  schedule_state: string;
  planned_at: string | null;
  scheduled_at: string | null;
  timezone: string;
  approver_required: number;
  approver_approved: number;
  preview_asset_url: string | null;
  labels: string[];
  assignee_user_id: string | null;
  client_visible: boolean;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  workflow: ApiContentWorkflow;
};

export function toContentRow(c: ApiContent): ContentRow {
  return {
    id: c.id,
    campaignId: c.campaign_id ?? '',
    brandId: c.brand_id,
    title: c.title,
    track: c.track,
    channel: c.channel,
    contentType: c.content_type,
    status: c.status,
    scheduledAt: c.scheduled_at,
    plannedAt: c.planned_at ?? undefined,
    scheduleState: c.schedule_state as ContentRow['scheduleState'],
    approvalState: c.approval_state as ContentRow['approvalState'],
    approverApproved: c.approver_approved,
    approverRequired: c.approver_required,
    assignee: c.assignee_user_id ?? '—',
    previewAsset: c.preview_asset_url ?? '',
    deliverableId: null,
    caption: c.caption ?? undefined,
  };
}

export async function listContentForBrand(
  brandId: string,
  query?: { campaignId?: string; status?: string; track?: string; q?: string },
): Promise<ApiContent[]> {
  const params = new URLSearchParams();
  if (query?.campaignId) params.set('campaignId', query.campaignId);
  if (query?.status) params.set('status', query.status);
  if (query?.track) params.set('track', query.track);
  if (query?.q) params.set('q', query.q);
  params.set('limit', '200');
  const qs = params.toString();
  const res = await api<{ data: ApiContent[] }>(
    `/api/v1/brands/${brandId}/content${qs ? `?${qs}` : ''}`,
  );
  return res.data ?? [];
}

export async function listAllContent(brandIds: string[]): Promise<ApiContent[]> {
  const batches = await Promise.all(
    brandIds.map((id) => listContentForBrand(id).catch(() => [] as ApiContent[])),
  );
  return batches.flat();
}

export async function getContentProduction(contentId: string): Promise<{
  data: ApiContent;
  approval_events: unknown[];
}> {
  return api(`/api/v1/content/${contentId}`);
}

export async function createContentProduction(input: {
  brandId: string;
  title: ApiLocale | string;
  caption?: ApiLocale | string;
  campaignId?: string | null;
  contentType: ContentRow['contentType'];
  channel: string;
  track?: ContentRow['track'];
  plannedAt?: string | null;
  labels?: string[];
}): Promise<ApiContent> {
  const { brandId, ...body } = input;
  const res = await api<{ data: ApiContent }>(`/api/v1/brands/${brandId}/content`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function updateContentProduction(
  contentId: string,
  patch: Record<string, unknown>,
): Promise<ApiContent> {
  const res = await api<{ data: ApiContent }>(`/api/v1/content/${contentId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.data;
}

export async function requestContentApproval(contentId: string, note?: ApiLocale | string) {
  const res = await api<{ data: ApiContent }>(`/api/v1/content/${contentId}/request-approval`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
  return res.data;
}

export async function approveContent(contentId: string, note?: ApiLocale | string) {
  const res = await api<{ data: ApiContent }>(`/api/v1/content/${contentId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
  return res.data;
}

export async function scheduleContent(
  contentId: string,
  input: { scheduledAt: string; timezone?: string },
) {
  const res = await api<{ data: ApiContent }>(`/api/v1/content/${contentId}/schedule`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function unscheduleContent(contentId: string) {
  const res = await api<{ data: ApiContent }>(`/api/v1/content/${contentId}/unschedule`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return res.data;
}

export async function archiveContent(contentId: string) {
  const res = await api<{ data: ApiContent }>(`/api/v1/content/${contentId}/archive`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return res.data;
}

export async function getContentPreferences(brandId: string) {
  return api<{
    data: { brand_id: string; approval_policy: string; default_timezone: string };
  }>(`/api/v1/brands/${brandId}/content-preferences`);
}

/** Load brands + campaigns + content for Content Plan screen (production). */
export async function loadContentWorkspace(): Promise<{
  brands: { id: string; name: { en: string; ar: string }; state: string; profileStatus: string; strategyId: null }[];
  campaigns: CampaignRow[];
  content: ContentRow[];
  policy: 'NONE' | 'OPTIONAL' | 'REQUIRED';
}> {
  const brandRows = await listBrandsProduction();
  const brandIds = brandRows.map((b) => b.id);
  const [campaigns, contentItems] = await Promise.all([
    brandIds.length ? listAllCampaigns(brandIds) : Promise.resolve([]),
    brandIds.length ? listAllContent(brandIds) : Promise.resolve([]),
  ]);
  let policy: 'NONE' | 'OPTIONAL' | 'REQUIRED' = 'OPTIONAL';
  if (brandIds[0]) {
    try {
      const prefs = await getContentPreferences(brandIds[0]);
      policy = (prefs.data.approval_policy as typeof policy) || 'OPTIONAL';
    } catch {
      /* keep default */
    }
  }
  return {
    brands: brandRows.map((b) => ({
      id: b.id,
      name: { en: b.name, ar: b.name },
      state: b.status === 'ARCHIVED' ? 'draft' : 'healthy',
      profileStatus: b.status,
      strategyId: null,
    })),
    campaigns: campaigns.map((c) => toCampaignRow(c)),
    content: contentItems.map((c) => toContentRow(c)),
    policy,
  };
}

export function contentApiError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const e = err as {
      message?: string;
      status?: number;
      data?: { error?: { message?: string; code?: string } };
    };
    if (e.data?.error?.message) {
      const code = e.data.error.code;
      if (code === 'PERMISSION_DENIED') {
        return `${e.data.error.message} (content capability — re-run seed)`;
      }
      if (code === 'SCHEDULE_BLOCKED') {
        return e.data.error.message;
      }
      return e.data.error.message;
    }
    if (e.message) return e.message;
    if (e.status === 403) return 'Permission denied (content capability required)';
    if (e.status === 404) return 'Not found';
  }
  return fallback;
}


export type ApiDayNote = {
  id: string;
  brand_id: string;
  day_key: string;
  text: { en: string; ar: string };
  color: string;
  locked: boolean;
};

export async function listDayNotes(brandId: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  const res = await api<{ data: ApiDayNote[] }>(`/api/v1/brands/${brandId}/day-notes${qs ? `?${qs}` : ""}`);
  return res.data ?? [];
}

export async function upsertDayNote(brandId: string, input: { dayKey: string; text?: string; color?: string; locked?: boolean }) {
  const res = await api<{ data: ApiDayNote }>(`/api/v1/brands/${brandId}/day-notes`, { method: "POST", body: JSON.stringify(input) });
  return res.data;
}

export async function deleteDayNote(brandId: string, dayKey: string) {
  return api(`/api/v1/brands/${brandId}/day-notes/${dayKey}`, { method: "DELETE", body: JSON.stringify({}) });
}

export async function setClientVisible(contentId: string, clientVisible: boolean) {
  const res = await api<{ data: ApiContent }>(`/api/v1/content/${contentId}/visibility`, { method: "POST", body: JSON.stringify({ clientVisible }) });
  return res.data;
}

export async function setContentLabels(contentId: string, labels: string[]) {
  const res = await api<{ data: ApiContent }>(`/api/v1/content/${contentId}/labels`, { method: "POST", body: JSON.stringify({ labels }) });
  return res.data;
}

export async function listContentLabels(brandId: string) {
  const res = await api<{ data: Array<{ id: string; name: { en: string; ar: string }; color: string }> }>(`/api/v1/brands/${brandId}/content-labels`);
  return res.data ?? [];
}

export async function createContentLabel(brandId: string, name: string, color?: string) {
  const res = await api<{ data: { id: string; name: { en: string; ar: string }; color: string } }>(`/api/v1/brands/${brandId}/content-labels`, { method: "POST", body: JSON.stringify({ name, color }) });
  return res.data;
}

export async function saveContentAsTemplate(brandId: string, input: { name: string; fromContentId: string }) {
  return api(`/api/v1/brands/${brandId}/content-templates`, { method: "POST", body: JSON.stringify(input) });
}

export async function listContentTemplates(brandId: string) {
  const res = await api<{ data: Array<{ id: string; name: { en: string; ar: string } }> }>(`/api/v1/brands/${brandId}/content-templates`);
  return res.data ?? [];
}

export async function useContentTemplate(brandId: string, templateId: string, overrides?: { campaignId?: string | null; plannedAt?: string | null }) {
  const res = await api<{ data: ApiContent }>(`/api/v1/brands/${brandId}/content-templates/${templateId}/use`, { method: "POST", body: JSON.stringify(overrides ?? {}) });
  return res.data;
}
