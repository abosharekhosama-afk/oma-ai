/**
 * Production Content API client + adapter to stage3 ContentRow shape.
 */
import { api } from './api';
import type { ContentRow } from './demo/stage3-campaigns';
import type { ApiLocale } from './campaign-api';
import {
  listScopedBrands,
  listAllCampaigns,
  listCampaignsForBrand,
  toCampaignRow,
} from './campaign-api';
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
  publishingConnected: boolean;
};

export type ApiContentPublishing = {
  social_page_id: string | null;
  state: string;
  attempts: number;
  last_error: string | null;
  external_post_url: string | null;
  published_at: string | null;
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
  assignee_name?: string | null;
  client_visible: boolean;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  media_asset_ids?: string[];
  workflow: ApiContentWorkflow;
  publishing?: ApiContentPublishing;
};

export type ContentRowExtra = ContentRow & {
  labels?: string[];
  clientVisible?: boolean;
  requestId?: string | null;
  taskId?: string | null;
  socialPageId?: string | null;
  publishState?: string;
  publishError?: string | null;
  externalPostUrl?: string | null;
};

export function toContentRow(c: ApiContent): ContentRowExtra {
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
    assignee: (c.assignee_name && c.assignee_name.trim()) || '—',
    previewAsset: c.preview_asset_url ?? '',
    deliverableId: null,
    caption: c.caption ?? undefined,
    labels: c.labels ?? [],
    clientVisible: c.client_visible !== false,
    socialPageId: c.publishing?.social_page_id ?? null,
    publishState: c.publishing?.state ?? 'NONE',
    publishError: c.publishing?.last_error ?? null,
    externalPostUrl: c.publishing?.external_post_url ?? null,
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
  /** WorkDrive MediaAsset (kind posts) shown as the post media. */
  preview_asset_id?: string | null;
  /** Ordered WorkDrive MediaAsset ids attached to the post. */
  media_asset_ids?: string[] | null;
}): Promise<ApiContent> {
  const { brandId, ...body } = input;
  const res = await api<{ data: ApiContent }>(`/api/v1/brands/${brandId}/content`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function setContentPublishTarget(contentId: string, socialPageId: string | null) {
  return api<{ data: { id: string; social_page_id: string | null; publish_state: string } }>(
    `/api/v1/content/${contentId}/publish-target`,
    { method: 'POST', body: JSON.stringify({ socialPageId }) },
  );
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

/** Load brands + campaigns + content for Content Plan screen (production).
 *  Fast path: primary brand first so the calendar can paint quickly.
 *  Pass `{ full: true }` or call `loadContentWorkspaceRest` for remaining brands.
 */
export async function loadContentWorkspace(opts?: { full?: boolean }): Promise<{
  brands: {
    id: string;
    name: { en: string; ar: string };
    state: string;
    profileStatus: string;
    strategyId: null;
  }[];
  campaigns: CampaignRow[];
  content: ContentRow[];
  policy: 'NONE' | 'OPTIONAL' | 'REQUIRED';
  remainingBrandIds: string[];
}> {
  const brandRows = await listScopedBrands();
  const brandIds = brandRows.map((b) => b.id);
  const primary = brandIds[0];
  const rest = brandIds.slice(1);

  // Parallel: primary campaigns + content + prefs (non-blocking default)
  const [campaigns, contentItems, policy] = await Promise.all([
    primary
      ? opts?.full
        ? listAllCampaigns(brandIds).catch(() => [] as Awaited<ReturnType<typeof listAllCampaigns>>)
        : listCampaignsForBrand(primary).catch(
            () => [] as Awaited<ReturnType<typeof listCampaignsForBrand>>,
          )
      : Promise.resolve([]),
    primary
      ? opts?.full
        ? listAllContent(brandIds)
        : listContentForBrand(primary).catch(() => [] as ApiContent[])
      : Promise.resolve([] as ApiContent[]),
    primary
      ? getContentPreferences(primary)
          .then((p) => (p.data.approval_policy as 'NONE' | 'OPTIONAL' | 'REQUIRED') || 'OPTIONAL')
          .catch(() => 'OPTIONAL' as const)
      : Promise.resolve('OPTIONAL' as const),
  ]);

  return {
    brands: brandRows.map((b) => ({
      id: b.id,
      name: { en: b.name, ar: b.name },
      state: b.status === 'ARCHIVED' ? 'draft' : 'healthy',
      profileStatus: b.status,
      strategyId: null,
    })),
    campaigns: (Array.isArray(campaigns) ? campaigns : []).map((c) => toCampaignRow(c)),
    content: contentItems.map((c) => toContentRow(c)),
    policy,
    remainingBrandIds: opts?.full ? [] : rest,
  };
}

/** Background hydrate remaining brands after first paint. */
/** All brands — for Schedule / cross-workspace planning surfaces. */
export async function loadScheduleWorkspace(): Promise<{
  brands: Awaited<ReturnType<typeof loadContentWorkspace>>['brands'];
  campaigns: CampaignRow[];
  content: ContentRow[];
  policy: 'NONE' | 'OPTIONAL' | 'REQUIRED';
}> {
  const ws = await loadContentWorkspace({ full: true });
  return {
    brands: ws.brands,
    campaigns: ws.campaigns,
    content: ws.content,
    policy: ws.policy,
  };
}

export async function loadContentWorkspaceRest(brandIds: string[]): Promise<{
  campaigns: CampaignRow[];
  content: ContentRow[];
}> {
  if (!brandIds.length) return { campaigns: [], content: [] };
  const [campaigns, contentItems] = await Promise.all([
    listAllCampaigns(brandIds).catch(() => []),
    listAllContent(brandIds),
  ]);
  return {
    campaigns: campaigns.map((c) => toCampaignRow(c)),
    content: contentItems.map((c) => toContentRow(c)),
  };
}

/** User-facing message for a failed content request (already localized by `api`). */
export function contentApiError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: string; status?: number };
    if (typeof e.status === 'number' && e.message) return e.message;
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
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  const res = await api<{ data: ApiDayNote[] }>(
    `/api/v1/brands/${brandId}/day-notes${qs ? `?${qs}` : ''}`,
  );
  return res.data ?? [];
}

export async function upsertDayNote(
  brandId: string,
  input: { dayKey: string; text?: string; color?: string; locked?: boolean },
) {
  const res = await api<{ data: ApiDayNote }>(`/api/v1/brands/${brandId}/day-notes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function deleteDayNote(brandId: string, dayKey: string) {
  return api(`/api/v1/brands/${brandId}/day-notes/${dayKey}`, {
    method: 'DELETE',
    body: JSON.stringify({}),
  });
}

export async function setClientVisible(contentId: string, clientVisible: boolean) {
  const res = await api<{ data: ApiContent }>(`/api/v1/content/${contentId}/visibility`, {
    method: 'POST',
    body: JSON.stringify({ clientVisible }),
  });
  return res.data;
}

export async function setContentLabels(contentId: string, labels: string[]) {
  const res = await api<{ data: ApiContent }>(`/api/v1/content/${contentId}/labels`, {
    method: 'POST',
    body: JSON.stringify({ labels }),
  });
  return res.data;
}

export async function listContentLabels(brandId: string) {
  const res = await api<{
    data: Array<{ id: string; name: { en: string; ar: string }; color: string }>;
  }>(`/api/v1/brands/${brandId}/content-labels`);
  return res.data ?? [];
}

export async function createContentLabel(brandId: string, name: string, color?: string) {
  const res = await api<{ data: { id: string; name: { en: string; ar: string }; color: string } }>(
    `/api/v1/brands/${brandId}/content-labels`,
    { method: 'POST', body: JSON.stringify({ name, color }) },
  );
  return res.data;
}

export async function saveContentAsTemplate(
  brandId: string,
  input: { name: string; fromContentId: string },
) {
  return api(`/api/v1/brands/${brandId}/content-templates`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listContentTemplates(brandId: string) {
  const res = await api<{ data: Array<{ id: string; name: { en: string; ar: string } }> }>(
    `/api/v1/brands/${brandId}/content-templates`,
  );
  return res.data ?? [];
}

export async function useContentTemplate(
  brandId: string,
  templateId: string,
  overrides?: { campaignId?: string | null; plannedAt?: string | null },
) {
  const res = await api<{ data: ApiContent }>(
    `/api/v1/brands/${brandId}/content-templates/${templateId}/use`,
    { method: 'POST', body: JSON.stringify(overrides ?? {}) },
  );
  return res.data;
}

export type ApprovalEvent = {
  id: string;
  action: string;
  actor_user_id: string;
  note: { en: string; ar: string } | null;
  at: string;
};

export type ContentCommentDto = {
  id: string;
  author_user_id: string;
  body: { en: string; ar: string };
  at: string;
};

export async function getContentDetail(contentId: string): Promise<{
  data: ApiContent;
  approval_events: ApprovalEvent[];
  comments: ContentCommentDto[];
}> {
  return api(`/api/v1/content/${contentId}`);
}

export async function addContentComment(contentId: string, body: ApiLocale | string) {
  const res = await api<{ data: ContentCommentDto }>(`/api/v1/content/${contentId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  return res.data;
}

export async function deleteContentComment(contentId: string, commentId: string) {
  return api(`/api/v1/content/${contentId}/comments/${commentId}`, { method: 'DELETE' });
}

export async function requestContentChanges(contentId: string, note?: ApiLocale | string) {
  const res = await api<{ data: ApiContent }>(`/api/v1/content/${contentId}/request-changes`, {
    method: 'POST',
    body: JSON.stringify({ note: note ?? { en: 'Changes requested', ar: 'تم طلب تعديلات' } }),
  });
  return res.data;
}

export async function rejectContent(contentId: string, note?: ApiLocale | string) {
  const res = await api<{ data: ApiContent }>(`/api/v1/content/${contentId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
  return res.data;
}

export async function markContentPublished(contentId: string) {
  const res = await api<{ data: ApiContent }>(`/api/v1/content/${contentId}/mark-published`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return res.data;
}

export async function listBrandLabels(brandId: string) {
  const res = await api<{ data: { id: string; name: ApiLocale; color: string }[] }>(
    `/api/v1/brands/${brandId}/content-labels`,
  );
  return res.data ?? [];
}

export async function createBrandLabel(brandId: string, name: ApiLocale | string, color?: string) {
  const res = await api<{ data: { id: string; name: ApiLocale; color: string } }>(
    `/api/v1/brands/${brandId}/content-labels`,
    { method: 'POST', body: JSON.stringify({ name, color }) },
  );
  return res.data;
}

export async function listBrandTemplates(brandId: string) {
  const res = await api<{ data: unknown[] }>(`/api/v1/brands/${brandId}/content-templates`);
  return res.data ?? [];
}

export function workflowLabel(
  item: { status: string; approvalState?: string; scheduleState?: string },
  isAr: boolean,
): string {
  if (item.status === 'PUBLISHED_SAMPLE') return isAr ? 'منشور (تجريبي)' : 'Published (sample)';
  if (item.approvalState === 'PENDING') return isAr ? 'بانتظار الموافقة' : 'Pending approval';
  if (item.approvalState === 'CHANGES_REQUESTED')
    return isAr ? 'تعديلات مطلوبة' : 'Changes requested';
  if (item.approvalState === 'REJECTED') return isAr ? 'مرفوض' : 'Rejected';
  if (item.approvalState === 'APPROVED' && item.scheduleState === 'SCHEDULED') {
    return isAr ? 'مجدول' : 'Scheduled';
  }
  if (item.approvalState === 'APPROVED') return isAr ? 'معتمد' : 'Approved';
  if (item.status === 'IN_REVIEW') return isAr ? 'قيد المراجعة' : 'In review';
  return isAr ? 'مسودة' : 'Draft';
}
