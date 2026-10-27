/**
 * Production Work Ops API (Requests / Tasks / Deliverables).
 */
import { api } from './api';
import type { ApiLocale } from './campaign-api';
import { listScopedBrands, listAllCampaigns, toCampaignRow } from './campaign-api';
import type { RequestRow } from './demo/stage4-requests';
import type { TaskRow } from './demo/stage4-tasks';
import type { DeliverableRow } from './demo/stage5-deliverables';

export type ApiWorkRequest = {
  id: string;
  tenant_id: string;
  brand_id: string;
  campaign_id: string | null;
  content_id: string | null;
  title: ApiLocale;
  description: ApiLocale;
  type: string;
  priority: string;
  status: string;
  due_at: string | null;
  requester_user_id: string;
  assignee_user_id: string | null;
  channels: string[];
  formats: string[];
  brief?: {
    objective: ApiLocale;
    audience: ApiLocale;
    key_message: ApiLocale;
    ready: boolean;
    ready_at: string | null;
    missing: string[];
  };
  created_at: string;
  updated_at: string;
  /** Human-readable labels from API enrichment */
  requester_name?: string | null;
  assignee_name?: string | null;
  brand_name?: string | null;
  campaign_name?: string | null;
};

export type ApiWorkTask = {
  id: string;
  tenant_id?: string;
  brand_id: string;
  campaign_id?: string | null;
  request_id: string | null;
  content_id: string | null;
  title: ApiLocale;
  description?: ApiLocale;
  status: string;
  priority?: string;
  department?: string;
  assignee_user_id: string | null;
  due_at: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  assignee_name?: string | null;
  created_by_name?: string | null;
  /** List endpoint only: lightweight counts for board cards. */
  comment_count?: number;
  deliverable_id?: string | null;
  checklist_total?: number;
  checklist_done?: number;
};

export type ApiWorkDeliverable = {
  id: string;
  tenant_id?: string;
  brand_id: string;
  campaign_id?: string | null;
  request_id: string | null;
  task_id: string | null;
  content_id: string | null;
  title: ApiLocale;
  description?: ApiLocale;
  status: string;
  review_status: string;
  asset_url?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string | null;
  brand_name?: string | null;
  campaign_name?: string | null;
  request_title?: string | null;
  task_title?: string | null;
  current_version_id?: string | null;
  approved_version_id?: string | null;
};

export type ApiDeliverableVersion = {
  id: string;
  label: string;
  version_number: number;
  asset_url: string | null;
  notes?: ApiLocale;
  status: string;
  immutable?: boolean;
  created_by: string;
  created_by_name?: string;
  created_at: string;
};

export type ApiDeliverableAnnotation = {
  id: string;
  version_id: string | null;
  author_user_id: string;
  author_name?: string;
  body: ApiLocale;
  x: number;
  y: number;
  resolved: boolean;
  created_at: string;
};

export type ApiDeliverableComment = {
  id: string;
  version_id: string | null;
  author_user_id: string;
  author_name?: string;
  body: ApiLocale;
  resolved: boolean;
  created_at: string;
};

export function opsError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const e = err as {
      message?: string;
      status?: number;
      data?: { error?: { message?: string } };
    };
    if (e.data?.error?.message) return e.data.error.message;
    if (e.message) return e.message;
    if (e.status === 403) return 'Permission denied';
    if (e.status === 404) return 'Not found';
  }
  return fallback;
}

export function toRequestRow(r: ApiWorkRequest): RequestRow & {
  brandName?: string;
  campaignName?: string | null;
  requesterId?: string;
  assigneeId?: string | null;
} {
  const due = r.due_at ? r.due_at.slice(0, 10) : '';
  return {
    id: r.id,
    brandId: r.brand_id,
    campaignId: r.campaign_id,
    contentId: r.content_id,
    title: r.title,
    description: r.description,
    type: (r.type as RequestRow['type']) || 'CONTENT',
    priority: (r.priority as RequestRow['priority']) || 'MEDIUM',
    status: mapRequestStatus(r.status),
    dueAt: due,
    submittedAt: r.created_at.slice(0, 10),
    updatedAt: r.updated_at,
    requester: r.requester_name || 'Team member',
    assignee: r.assignee_name || null,
    requesterId: r.requester_user_id,
    assigneeId: r.assignee_user_id,
    brandName: r.brand_name || undefined,
    campaignName: r.campaign_name ?? null,
    briefId: null,
    outcome: undefined,
    formats: r.formats ?? [],
    channels: r.channels ?? [],
    references: [],
    conversionTaskIds: [],
  };
}

function mapRequestStatus(status: string): RequestRow['status'] {
  const s = (status || 'OPEN').toUpperCase();
  if (s === 'BLOCKED') return 'WAITING_INFO' as RequestRow['status'];
  if (s === 'CANCELLED') return 'CLOSED' as RequestRow['status'];
  if (s === 'IN_PROGRESS') return 'IN_PROGRESS' as RequestRow['status'];
  const allowed = [
    'OPEN',
    'ASSIGNED',
    'IN_PROGRESS',
    'WAITING_INFO',
    'READY_FOR_PRODUCTION',
    'IN_PRODUCTION',
    'DONE',
    'CLOSED',
  ];
  if (allowed.includes(s)) return s as RequestRow['status'];
  return 'OPEN' as RequestRow['status'];
}

export function toTaskRow(task: ApiWorkTask): TaskRow {
  const statusMap: Record<string, TaskRow['status']> = {
    BACKLOG: 'BACKLOG',
    TODO: 'BACKLOG',
    READY: 'READY',
    IN_PROGRESS: 'IN_PROGRESS',
    BLOCKED: 'BLOCKED',
    IN_REVIEW: 'IN_REVIEW',
    DONE: 'DONE',
    CANCELLED: 'DONE',
    OVERDUE: 'OVERDUE',
  };
  const status = statusMap[task.status] ?? 'BACKLOG';
  return {
    id: task.id,
    brandId: task.brand_id,
    campaignId: task.campaign_id ?? null,
    contentId: task.content_id,
    requestId: task.request_id,
    briefId: null,
    deliverableId: task.deliverable_id ?? null,
    title: task.title,
    description: stripBriefCopy(task.description),
    type: 'COPY',
    status,
    assignee: task.assignee_name || (task.assignee_user_id ? 'Team member' : 'Unassigned'),
    department: task.department || '',
    priority: (task.priority as TaskRow['priority']) || 'MEDIUM',
    dueAt: task.due_at ? task.due_at.slice(0, 10) : '',
    updatedAt: task.updated_at ?? new Date().toISOString(),
    blockedReason: null,
    dependencies: [],
    checklist: [],
    comments: [],
    activity: [],
    assigneeUserId: task.assignee_user_id ?? null,
    commentCount: typeof task.comment_count === 'number' ? task.comment_count : undefined,
    checklistTotal: typeof task.checklist_total === 'number' ? task.checklist_total : undefined,
    checklistDone: typeof task.checklist_done === 'number' ? task.checklist_done : undefined,
  };
}

export type DeliverableRowExtra = DeliverableRow & {
  brandName?: string;
  campaignName?: string | null;
  requestTitle?: string | null;
  taskTitle?: string | null;
  createdByName?: string | null;
};

export function toDeliverableRowFromDetail(payload: {
  data: ApiWorkDeliverable;
  versions?: ApiDeliverableVersion[];
  annotations?: ApiDeliverableAnnotation[];
  comments?: ApiDeliverableComment[];
}): DeliverableRowExtra {
  const base = toDeliverableRow(payload.data);
  if (payload.versions?.length) {
    base.versions = payload.versions.map((v) => {
      const url = v.asset_url || '';
      const approved = v.status === 'APPROVED' || v.immutable === true;
      return {
        id: v.id,
        label: v.label || 'v1',
        assets: url ? [url] : [],
        notes: v.notes || { en: '', ar: '' },
        createdAt: v.created_at,
        createdBy: v.created_by_name || 'Team member',
        immutable: approved,
        reviewDecision:
          v.status === 'APPROVED' || v.status === 'REJECTED'
            ? (v.status as 'APPROVED' | 'REJECTED')
            : null,
        status: (v.status as never) || 'DRAFT',
        // keep optional UI helpers without breaking demo shape
        previewUrl: url,
        isApproved: approved,
      };
    }) as DeliverableRow['versions'];
    base.currentVersionId =
      payload.data.current_version_id ||
      payload.versions[payload.versions.length - 1]?.id ||
      base.id;
    base.approvedVersionId = payload.data.approved_version_id || null;
  }
  // Always ensure arrays so UI .filter/.map never throws
  base.annotations = (payload.annotations ?? []).map((a) => ({
    id: a.id,
    body: a.body || { en: '', ar: '' },
    author: a.author_name || 'Team member',
    at: a.created_at,
    x: typeof a.x === 'number' ? a.x : 0.5,
    y: typeof a.y === 'number' ? a.y : 0.5,
    resolved: !!a.resolved,
    versionId: a.version_id || base.currentVersionId,
  })) as DeliverableRow['annotations'];
  base.comments = (payload.comments ?? []).map((c) => ({
    id: c.id,
    body: c.body || { en: '', ar: '' },
    author: c.author_name || 'Team member',
    at: c.created_at,
    resolved: !!c.resolved,
    versionId: c.version_id || base.currentVersionId,
  })) as DeliverableRow['comments'];
  if (!Array.isArray(base.versions) || base.versions.length === 0) {
    // fallback already from toDeliverableRow
  }
  return base;
}

function inferDeliverableType(assetUrl: string | null | undefined): DeliverableRow['type'] {
  if (!assetUrl) return 'STATIC';
  const lower = assetUrl.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(lower)) return 'PHOTOGRAPHY';
  if (/\.(mp4|webm|mov)(\?|$)/.test(lower)) return 'LONG_VIDEO';
  return 'STATIC';
}

export function toDeliverableRow(d: ApiWorkDeliverable): DeliverableRowExtra {
  const review = mapReviewStatus(d.review_status || d.status);
  const creator = d.created_by_name || 'Team member';
  const versionId = d.current_version_id || d.id;
  const asset = d.asset_url || '';
  const archived = (d.status || '').toUpperCase() === 'ARCHIVED';
  return {
    id: d.id,
    brandId: d.brand_id,
    campaignId: d.campaign_id ?? '',
    requestId: d.request_id,
    taskId: d.task_id,
    contentId: d.content_id,
    title: d.title,
    type: inferDeliverableType(asset),
    reviewStatus: review,
    owner: creator,
    dueAt: d.updated_at?.slice(0, 10) || '',
    reviewer: creator,
    archived,
    currentVersionId: versionId,
    approvedVersionId: d.approved_version_id ?? null,
    versions: [
      {
        id: versionId,
        label: 'v1',
        assets: asset ? [asset] : [],
        notes: { en: '', ar: '' },
        createdAt: d.created_at || new Date().toISOString(),
        createdBy: creator,
        immutable:
          review === 'APPROVED' &&
          Boolean(d.approved_version_id) &&
          d.approved_version_id === versionId,
        reviewDecision: review === 'APPROVED' || review === 'REJECTED' ? review : null,
        status: (d.status as never) || 'DRAFT',
        previewUrl: asset,
        isApproved: review === 'APPROVED',
      } as DeliverableRow['versions'][number],
    ],
    changeRequests: [],
    annotations: [],
    comments: [],
    activity: [],
    decisions: [],
    brandName: d.brand_name || undefined,
    campaignName: d.campaign_name ?? null,
    requestTitle: d.request_title ?? null,
    taskTitle: d.task_title ?? null,
    createdByName: creator,
  };
}

function mapReviewStatus(s: string): DeliverableRow['reviewStatus'] {
  const map: Record<string, DeliverableRow['reviewStatus']> = {
    NOT_STARTED: 'DRAFT',
    DRAFT: 'DRAFT',
    IN_PROGRESS: 'DRAFT',
    AWAITING_REVIEW: 'AWAITING_REVIEW',
    IN_REVIEW: 'IN_REVIEW',
    CHANGES_REQUESTED: 'CHANGES_REQUESTED',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    DONE: 'APPROVED',
    ARCHIVED: 'APPROVED',
  };
  return map[s] ?? 'DRAFT';
}

// --- Requests ---
export async function listRequests(
  brandId: string,
  query?: { status?: string; q?: string },
): Promise<ApiWorkRequest[]> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.q) params.set('q', query.q);
  const qs = params.toString();
  const res = await api<{ data: ApiWorkRequest[] }>(
    `/api/v1/brands/${brandId}/requests${qs ? `?${qs}` : ''}`,
  );
  return res.data ?? [];
}

export async function listAllRequests(brandIds: string[]): Promise<ApiWorkRequest[]> {
  const batches = await Promise.all(brandIds.map((id) => listRequests(id)));
  return batches.flat();
}

export async function getRequest(requestId: string): Promise<{
  data: ApiWorkRequest;
  tasks: ApiWorkTask[];
  deliverables: ApiWorkDeliverable[];
}> {
  return api(`/api/v1/requests/${requestId}`);
}

export async function createRequest(
  brandId: string,
  input: {
    title: ApiLocale | string;
    description?: ApiLocale | string;
    type?: string;
    priority?: string;
    campaignId?: string | null;
    contentId?: string | null;
    dueAt?: string | null;
    assigneeUserId?: string | null;
    channels?: string[];
    formats?: string[];
  },
): Promise<ApiWorkRequest> {
  const res = await api<{ data: ApiWorkRequest }>(`/api/v1/brands/${brandId}/requests`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateRequest(
  requestId: string,
  patch: Record<string, unknown>,
): Promise<ApiWorkRequest> {
  const res = await api<{ data: ApiWorkRequest }>(`/api/v1/requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.data;
}

export async function convertRequestToTask(requestId: string): Promise<ApiWorkTask> {
  const res = await api<{ data: ApiWorkTask }>(`/api/v1/requests/${requestId}/convert-to-task`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return res.data;
}

// --- Tasks ---
export async function listTasks(brandId: string, status?: string): Promise<ApiWorkTask[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await api<{ data: ApiWorkTask[] }>(`/api/v1/brands/${brandId}/tasks${qs}`);
  return res.data ?? [];
}

export async function createTask(
  brandId: string,
  input: {
    title: ApiLocale | string;
    description?: ApiLocale | string;
    requestId?: string | null;
    contentId?: string | null;
    campaignId?: string | null;
    status?: string;
    assigneeUserId?: string | null;
    dueAt?: string | null;
  },
): Promise<ApiWorkTask> {
  const res = await api<{ data: ApiWorkTask }>(`/api/v1/brands/${brandId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateTask(
  taskId: string,
  patch: Record<string, unknown>,
): Promise<ApiWorkTask> {
  const res = await api<{ data: ApiWorkTask }>(`/api/v1/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.data;
}

export async function convertTaskToDeliverable(taskId: string): Promise<ApiWorkDeliverable> {
  const res = await api<{ data: ApiWorkDeliverable }>(
    `/api/v1/tasks/${taskId}/convert-to-deliverable`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return res.data;
}

// --- Deliverables ---
export async function listDeliverables(brandId: string): Promise<ApiWorkDeliverable[]> {
  const res = await api<{ data: ApiWorkDeliverable[] }>(`/api/v1/brands/${brandId}/deliverables`);
  return res.data ?? [];
}

export async function getDeliverable(deliverableId: string): Promise<ApiWorkDeliverable> {
  const res = await api<{ data: ApiWorkDeliverable }>(`/api/v1/deliverables/${deliverableId}`);
  return res.data;
}

export async function getDeliverableDetail(deliverableId: string): Promise<{
  data: ApiWorkDeliverable;
  versions: ApiDeliverableVersion[];
  annotations: ApiDeliverableAnnotation[];
  comments: ApiDeliverableComment[];
}> {
  const res = await api<{
    data: ApiWorkDeliverable;
    versions?: ApiDeliverableVersion[];
    annotations?: ApiDeliverableAnnotation[];
    comments?: ApiDeliverableComment[];
  }>(`/api/v1/deliverables/${deliverableId}`);
  // Support both enriched payload and legacy { data } only
  const data = (res as { data: ApiWorkDeliverable }).data ?? (res as unknown as ApiWorkDeliverable);
  const full = res as {
    data?: ApiWorkDeliverable;
    versions?: ApiDeliverableVersion[];
    annotations?: ApiDeliverableAnnotation[];
    comments?: ApiDeliverableComment[];
  };
  return {
    data,
    versions: full.versions ?? [],
    annotations: full.annotations ?? [],
    comments: full.comments ?? [],
  };
}

export async function addDeliverableVersion(
  deliverableId: string,
  input: {
    assetUrl?: string | null;
    asset_id?: string | null;
    label?: string;
    notes?: ApiLocale | string;
  },
) {
  return api(`/api/v1/deliverables/${deliverableId}/versions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function addDeliverableAnnotation(
  deliverableId: string,
  input: { body: ApiLocale | string; x?: number; y?: number; versionId?: string | null },
) {
  return api(`/api/v1/deliverables/${deliverableId}/annotations`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function resolveDeliverableAnnotation(annotationId: string, resolved = true) {
  return api(`/api/v1/deliverable-annotations/${annotationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ resolved }),
  });
}

export async function addDeliverableComment(
  deliverableId: string,
  input: { body: ApiLocale | string; versionId?: string | null },
) {
  return api(`/api/v1/deliverables/${deliverableId}/comments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getTaskDetail(taskId: string) {
  return api<{
    data: ApiWorkTask;
    checklist: { id: string; title: ApiLocale; done: boolean; sort_order: number }[];
    comments: {
      id: string;
      author_user_id: string;
      author_name?: string;
      body: ApiLocale;
      created_at: string;
    }[];
  }>(`/api/v1/tasks/${taskId}`);
}

export async function addTaskChecklistItem(taskId: string, title: ApiLocale | string) {
  return api(`/api/v1/tasks/${taskId}/checklist`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function updateTaskChecklistItem(
  taskId: string,
  itemId: string,
  patch: { done?: boolean; title?: ApiLocale | string },
) {
  return api(`/api/v1/tasks/${taskId}/checklist/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function addTaskComment(taskId: string, body: ApiLocale | string) {
  return api(`/api/v1/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function updateDeliverable(
  deliverableId: string,
  patch: Record<string, unknown>,
): Promise<ApiWorkDeliverable> {
  const res = await api<{ data: ApiWorkDeliverable }>(`/api/v1/deliverables/${deliverableId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.data;
}

export async function reviewDeliverable(
  deliverableId: string,
  action: 'submit' | 'approve' | 'request_changes' | 'reject',
): Promise<ApiWorkDeliverable> {
  const res = await api<{ data: ApiWorkDeliverable }>(
    `/api/v1/deliverables/${deliverableId}/review`,
    { method: 'POST', body: JSON.stringify({ action }) },
  );
  return res.data;
}

export async function loadRequestsWorkspace(): Promise<{
  brands: {
    id: string;
    name: { en: string; ar: string };
    state: string;
    profileStatus: string;
    strategyId: null;
  }[];
  campaigns: { id: string; brandId: string; name: { en: string; ar: string } }[];
  requests: RequestRow[];
}> {
  const brandRows = await listScopedBrands();
  const brandIds = brandRows.map((b) => b.id);
  const [campaigns, requests] = await Promise.all([
    brandIds.length ? listAllCampaigns(brandIds) : Promise.resolve([]),
    brandIds.length ? listAllRequests(brandIds) : Promise.resolve([]),
  ]);
  return {
    brands: brandRows.map((b) => ({
      id: b.id,
      name: { en: b.name, ar: b.name },
      state: b.status === 'ARCHIVED' ? 'draft' : 'healthy',
      profileStatus: b.status,
      strategyId: null,
    })),
    campaigns: campaigns.map((c) => {
      const row = toCampaignRow(c);
      return { id: row.id, brandId: row.brandId, name: row.name };
    }),
    requests: requests.map(toRequestRow),
  };
}

export async function loadTasksWorkspace(): Promise<{
  brands: {
    id: string;
    name: { en: string; ar: string };
    state: string;
    profileStatus: string;
    strategyId: null;
  }[];
  campaigns: { id: string; brandId: string; name: { en: string; ar: string } }[];
  tasks: TaskRow[];
}> {
  const brandRows = await listScopedBrands();
  const brandIds = brandRows.map((b) => b.id);
  const [campaigns, taskBatches] = await Promise.all([
    brandIds.length ? listAllCampaigns(brandIds) : Promise.resolve([]),
    brandIds.length
      ? Promise.all(brandIds.map((id) => listTasks(id)))
      : Promise.resolve([] as ApiWorkTask[][]),
  ]);
  const campaignNames = new Map(
    campaigns.map((c) => {
      const row = toCampaignRow(c);
      return [row.id, row.name] as const;
    }),
  );
  const brandNames = new Map(brandRows.map((b) => [b.id, b.name] as const));
  const tasks = (taskBatches as ApiWorkTask[][]).flat().map((x) => {
    const row = toTaskRow(x);
    return {
      ...row,
      brandName: brandNames.get(row.brandId),
      campaignName: row.campaignId ? (campaignNames.get(row.campaignId) ?? null) : null,
    };
  });
  return {
    brands: brandRows.map((b) => ({
      id: b.id,
      name: { en: b.name, ar: b.name },
      state: b.status === 'ARCHIVED' ? 'draft' : 'healthy',
      profileStatus: b.status,
      strategyId: null,
    })),
    campaigns: campaigns.map((c) => {
      const row = toCampaignRow(c);
      return { id: row.id, brandId: row.brandId, name: row.name };
    }),
    tasks,
  };
}

export async function loadDeliverablesWorkspace(): Promise<{
  brands: {
    id: string;
    name: { en: string; ar: string };
    state: string;
    profileStatus: string;
    strategyId: null;
  }[];
  campaigns: { id: string; brandId: string; name: { en: string; ar: string } }[];
  deliverables: DeliverableRow[];
}> {
  const brandRows = await listScopedBrands();
  const brandIds = brandRows.map((b) => b.id);
  const [campaigns, delBatches] = await Promise.all([
    brandIds.length ? listAllCampaigns(brandIds) : Promise.resolve([]),
    brandIds.length
      ? Promise.all(brandIds.map((id) => listDeliverables(id)))
      : Promise.resolve([] as ApiWorkDeliverable[][]),
  ]);
  const deliverables = (delBatches as ApiWorkDeliverable[][])
    .flat()
    .map((x) => toDeliverableRow(x));
  return {
    brands: brandRows.map((b) => ({
      id: b.id,
      name: { en: b.name, ar: b.name },
      state: b.status === 'ARCHIVED' ? 'draft' : 'healthy',
      profileStatus: b.status,
      strategyId: null,
    })),
    campaigns: campaigns.map((c) => {
      const row = toCampaignRow(c);
      return { id: row.id, brandId: row.brandId, name: row.name };
    }),
    deliverables,
  };
}

/** Persist structured brief fields inside description until a Brief domain exists. */
export const BRIEF_MARKER = '__OMA_BRIEF_V1__';

export type RequestBriefPayload = {
  overview?: { en: string; ar: string };
  objective?: { en: string; ar: string };
  audience?: { en: string; ar: string };
  keyMessage?: { en: string; ar: string };
  deliverableType?: { en: string; ar: string };
  tone?: { en: string; ar: string };
  mandatory?: { en: string; ar: string };
  cta?: { en: string; ar: string };
  acceptance?: { en: string; ar: string };
  timelineNote?: { en: string; ar: string };
  channels?: string[];
  formats?: string[];
  readiness?: string;
};

export function encodeRequestBrief(
  payload: RequestBriefPayload,
  plainFallback: string,
): { en: string; ar: string } {
  const json = JSON.stringify(payload);
  const body = `${BRIEF_MARKER}${json}`;
  // Keep a human-readable prefix for list views
  const plain = plainFallback.trim() || payload.overview?.en || payload.objective?.en || '';
  return {
    en: plain ? `${plain}\n\n${body}` : body,
    ar: plain ? `${plain}\n\n${body}` : body,
  };
}

export function decodeRequestBrief(description: unknown): RequestBriefPayload | null {
  const text =
    typeof description === 'string'
      ? description
      : description &&
          typeof description === 'object' &&
          description !== null &&
          'en' in (description as object)
        ? String((description as { en?: string }).en ?? '')
        : '';
  const idx = text.indexOf(BRIEF_MARKER);
  if (idx < 0) return null;
  try {
    return JSON.parse(text.slice(idx + BRIEF_MARKER.length)) as RequestBriefPayload;
  } catch {
    return null;
  }
}

/** Human-readable text for a description that may carry an encoded brief payload. */
export function briefDisplayText(description: unknown, locale: string): string {
  const isAr = locale.toLowerCase().startsWith('ar');
  const raw =
    typeof description === 'string'
      ? description
      : description && typeof description === 'object'
        ? String(
            (isAr
              ? ((description as { ar?: string }).ar ?? (description as { en?: string }).en)
              : ((description as { en?: string }).en ?? (description as { ar?: string }).ar)) ??
              '',
          )
        : '';
  const idx = raw.indexOf(BRIEF_MARKER);
  if (idx < 0) return raw.trim();
  const plain = raw.slice(0, idx).trim();
  if (plain) return plain;
  const brief = decodeRequestBrief(raw);
  const pick = (c?: { en: string; ar: string }) => (c ? (isAr ? c.ar || c.en : c.en || c.ar) : '');
  return (pick(brief?.objective) || pick(brief?.overview) || '').trim();
}

/** Strip an encoded brief payload from a bilingual description for display. */
export function stripBriefCopy(description: unknown): { en: string; ar: string } {
  return { en: briefDisplayText(description, 'en'), ar: briefDisplayText(description, 'ar') };
}
