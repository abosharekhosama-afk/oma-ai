import { api } from './api';

export type BriefStatus =
  'DRAFT' | 'IN_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'CONVERTED' | 'CANCELLED';

export type BriefAction =
  'edit' | 'submit' | 'approve' | 'request_changes' | 'revise' | 'convert' | 'cancel';

export type BriefDeliverable = {
  key: string;
  title_en: string;
  title_ar: string;
  format: string;
  channel: string;
  department: string;
  due_at?: string | null;
  notes: string;
};

export type BriefContent = {
  objective_en: string;
  objective_ar: string;
  audience_en: string;
  audience_ar: string;
  key_message_en: string;
  key_message_ar: string;
  cta_en: string;
  cta_ar: string;
  channels: string[];
  mandatories: string[];
  references: string[];
  budget_note: string;
  due_at?: string | null;
  pillar_key?: string | null;
  deliverables: BriefDeliverable[];
};

export type BriefSummary = {
  id: string;
  title: string;
  status: BriefStatus;
  origin: string;
  current_version_no: number;
  row_version: number;
  task_count: number;
  comment_count: number;
  allowed_actions: BriefAction[];
  updated_at: string;
};

export type BriefDetail = {
  id: string;
  title: string;
  status: BriefStatus;
  origin: string;
  row_version: number;
  request_id: string | null;
  strategy_version_id: string | null;
  allowed_actions: BriefAction[];
  readiness: { ready: boolean; missing: string[] };
  current_version: {
    id: string;
    version_no: number;
    author_user_id: string;
    submitted_at: string | null;
    approved_at: string | null;
    content: BriefContent;
  } | null;
  versions: Array<{
    id: string;
    version_no: number;
    approved_at: string | null;
    created_at: string;
  }>;
  decisions: Array<{
    id: string;
    kind: string;
    from_status: BriefStatus;
    to_status: BriefStatus;
    comment: string | null;
    actor_user_id: string;
    self_approval: boolean;
    created_at: string;
  }>;
  comments: Array<{ id: string; body: string; author_user_id: string; created_at: string }>;
  tasks: Array<{
    id: string;
    title_en: string;
    title_ar: string;
    status: string;
    deliverable_key: string | null;
  }>;
  replayed?: boolean;
  created_task_count?: number;
};

export const BRIEF_STATUS_TONE: Record<BriefStatus, string> = {
  DRAFT: 'default',
  IN_REVIEW: 'processing',
  CHANGES_REQUESTED: 'warning',
  APPROVED: 'success',
  CONVERTED: 'purple',
  CANCELLED: 'error',
};

/** Route segment for each lifecycle action (edit is a PATCH, not an action route). */
export const BRIEF_ACTION_PATH: Record<Exclude<BriefAction, 'edit'>, string> = {
  submit: 'submit',
  approve: 'approve',
  request_changes: 'request-changes',
  revise: 'revise',
  convert: 'convert',
  cancel: 'cancel',
};

/** Buttons shown for a status, in Planable-like order (primary first). */
export function briefActionButtons(
  allowed: readonly BriefAction[],
): Array<Exclude<BriefAction, 'edit'>> {
  const order: Array<Exclude<BriefAction, 'edit'>> = [
    'submit',
    'approve',
    'request_changes',
    'convert',
    'revise',
    'cancel',
  ];
  return order.filter((a) => allowed.includes(a));
}

export function newDeliverable(index: number): BriefDeliverable {
  return {
    key: `deliverable-${index + 1}`,
    title_en: '',
    title_ar: '',
    format: '',
    channel: '',
    department: '',
    due_at: null,
    notes: '',
  };
}

const root = (brandId: string) => `/api/v1/brands/${brandId}/briefs`;

export function listBriefs(brandId: string, status?: BriefStatus) {
  return api<{ data: BriefSummary[] }>(`${root(brandId)}${status ? `?status=${status}` : ''}`);
}

export function getBrief(brandId: string, briefId: string) {
  return api<{ data: BriefDetail }>(`${root(brandId)}/${briefId}`);
}

export function createBrief(
  brandId: string,
  body: { title: string; content?: Partial<BriefContent> },
) {
  return api<{ data: BriefDetail }>(root(brandId), { method: 'POST', body: JSON.stringify(body) });
}

export function createBriefFromStrategy(
  brandId: string,
  body: { strategy_version_id: string; pillar_key?: string; title?: string },
) {
  return api<{ data: BriefDetail }>(`${root(brandId)}/from-strategy`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateBrief(
  brandId: string,
  briefId: string,
  body: { row_version: number; title?: string; content?: BriefContent },
) {
  return api<{ data: BriefDetail }>(`${root(brandId)}/${briefId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function briefAction(
  brandId: string,
  briefId: string,
  action: Exclude<BriefAction, 'edit'>,
  body: { row_version: number; comment?: string },
) {
  return api<{ data: BriefDetail }>(`${root(brandId)}/${briefId}/${BRIEF_ACTION_PATH[action]}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function commentOnBrief(brandId: string, briefId: string, body: string) {
  return api<{ data: { id: string } }>(`${root(brandId)}/${briefId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}
