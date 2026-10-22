/**
 * Production Work Ops API (Requests / Tasks / Deliverables).
 */
import { api } from './api';
import type { ApiLocale } from './campaign-api';
import { listBrandsProduction, listAllCampaigns, toCampaignRow } from './campaign-api';
import type { RequestRow } from './demo/stage4-requests';
import type { TaskRow } from './demo/stage4-tasks';
import type { DeliverableRow } from './demo/stage4-deliverables';

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
  created_at: string;
  updated_at: string;
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
  assignee_user_id: string | null;
  due_at: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
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

export function toRequestRow(r: ApiWorkRequest): RequestRow {
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
    requester: r.requester_user_id || '—',
    assignee: r.assignee_user_id,
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
    deliverableId: null,
    title: task.title,
    description: task.description ?? { en: '', ar: '' },
    type: 'COPY',
    status,
    assignee: task.assignee_user_id || 'Unassigned',
    department: '—',
    priority: 'MEDIUM',
    dueAt: task.due_at ? task.due_at.slice(0, 10) : '',
    updatedAt: task.updated_at ?? new Date().toISOString(),
    blockedReason: null,
    dependencies: [],
    checklist: [],
    comments: [],
    activity: [],
  };
}

export function toDeliverableRow(d: ApiWorkDeliverable): DeliverableRow {
  const review = mapReviewStatus(d.review_status || d.status);
  const versionId = `v1-${d.id}`;
  return {
    id: d.id,
    brandId: d.brand_id,
    campaignId: d.campaign_id ?? '',
    taskId: d.task_id,
    contentId: d.content_id,
    requestId: d.request_id,
    title: d.title,
    type: 'STATIC',
    reviewStatus: review,
    owner: d.created_by || '—',
    reviewer: '—',
    dueAt: d.updated_at ? d.updated_at.slice(0, 10) : '',
    archived: d.status === 'ARCHIVED' || d.status === 'CANCELLED',
    currentVersionId: versionId,
    approvedVersionId: review === 'APPROVED' ? versionId : null,
    versions: [
      {
        id: versionId,
        label: 'v1',
        assets: d.asset_url ? [d.asset_url] : [],
        notes: d.description ?? { en: '', ar: '' },
        createdAt: d.created_at ?? new Date().toISOString(),
        immutable: false,
        createdBy: d.created_by || '—',
        reviewDecision: review === 'APPROVED' || review === 'REJECTED' ? review : null,
        status: 'DRAFT',
      },
    ],
    changeRequests: [],
    annotations: [],
    comments: [],
    activity: [],
    decisions: [],
  };
}

function mapReviewStatus(s: string): DeliverableRow['reviewStatus'] {
  const map: Record<string, DeliverableRow['reviewStatus']> = {
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
  const batches = await Promise.all(
    brandIds.map((id) => listRequests(id).catch(() => [] as ApiWorkRequest[])),
  );
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
  const brandRows = await listBrandsProduction();
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
  const brandRows = await listBrandsProduction();
  const brandIds = brandRows.map((b) => b.id);
  const [campaigns, taskBatches] = await Promise.all([
    brandIds.length ? listAllCampaigns(brandIds) : Promise.resolve([]),
    brandIds.length
      ? Promise.all(brandIds.map((id) => listTasks(id).catch(() => [] as ApiWorkTask[])))
      : Promise.resolve([] as ApiWorkTask[][]),
  ]);
  const tasks = (taskBatches as ApiWorkTask[][]).flat().map((x) => toTaskRow(x));
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
  const brandRows = await listBrandsProduction();
  const brandIds = brandRows.map((b) => b.id);
  const [campaigns, delBatches] = await Promise.all([
    brandIds.length ? listAllCampaigns(brandIds) : Promise.resolve([]),
    brandIds.length
      ? Promise.all(brandIds.map((id) => listDeliverables(id).catch(() => [] as ApiWorkDeliverable[])))
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
