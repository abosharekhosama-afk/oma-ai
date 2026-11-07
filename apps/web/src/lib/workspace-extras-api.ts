import { api } from './api';

export type BrandRef = { id: string; name: string; logo_url?: string | null };

export type ContentLabel = {
  id: string;
  nameEn: string;
  nameAr?: string;
  color: string;
};

export type ContentTemplate = {
  id: string;
  nameEn: string;
  nameAr?: string;
  titleEn?: string | null;
  captionEn?: string | null;
};

export type TimeSlot = {
  id: string;
  time: string;
  day: string;
  color: string;
};

export type ApprovalMode = 'none' | 'optional' | 'required' | 'multi_level';

export type ApprovalSettings = {
  mode: ApprovalMode;
  requiredApprovers: number;
  scheduleOnApproval: boolean;
  lockAfterApproval: boolean;
  reminderPendingApprovals: boolean;
};

/** Server-persisted workspace settings (GET/PATCH /api/v1/workspace/settings). */
export type HolidayCalendarId = 'il' | 'ps' | 'us' | 'gb' | 'ae' | 'sa' | 'eg' | 'jo' | 'intl';

export type HolidayCatalogItem = {
  id: HolidayCalendarId;
  nameEn: string;
  nameAr: string;
};

export type WorkspaceSettings = {
  tenant_id: string;
  website_url: string | null;
  timezone: string;
  approval_mode: ApprovalMode;
  required_approvers: number;
  schedule_on_approval: boolean;
  lock_after_approval: boolean;
  reminder_pending_approvals?: boolean;
  listening_slack_webhook_url?: string | null;
  holiday_calendars?: HolidayCalendarId[];
  holiday_calendars_follow_timezone?: boolean;
  holiday_catalog?: HolidayCatalogItem[];
  holiday_calendars_default?: HolidayCalendarId[];
};

export const DEFAULT_APPROVALS: ApprovalSettings = {
  mode: 'optional',
  requiredApprovers: 1,
  scheduleOnApproval: false,
  lockAfterApproval: false,
  reminderPendingApprovals: false,
};

export function approvalsFromSettings(s: WorkspaceSettings): ApprovalSettings {
  return {
    mode: s.approval_mode,
    requiredApprovers: s.required_approvers ?? 1,
    scheduleOnApproval: s.schedule_on_approval,
    lockAfterApproval: s.lock_after_approval,
    reminderPendingApprovals: s.reminder_pending_approvals ?? false,
  };
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettings> {
  return api<WorkspaceSettings>('/api/v1/workspace/settings');
}

export async function patchWorkspaceSettings(
  patch: Partial<Omit<WorkspaceSettings, 'tenant_id'>>,
): Promise<WorkspaceSettings> {
  return api<WorkspaceSettings>('/api/v1/workspace/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function patchHolidayCalendars(
  holiday_calendars: HolidayCalendarId[],
): Promise<WorkspaceSettings> {
  return api<WorkspaceSettings>('/api/v1/workspace/holiday-calendars', {
    method: 'PATCH',
    body: JSON.stringify({ holiday_calendars }),
  });
}

export async function saveApprovalSettings(a: ApprovalSettings): Promise<ApprovalSettings> {
  const s = await patchWorkspaceSettings({
    approval_mode: a.mode,
    required_approvers:
      a.mode === 'multi_level'
        ? Math.max(2, a.requiredApprovers)
        : a.mode === 'required'
          ? Math.max(1, a.requiredApprovers)
          : 1,
    schedule_on_approval: a.scheduleOnApproval,
    lock_after_approval: a.lockAfterApproval,
    reminder_pending_approvals: a.reminderPendingApprovals,
  });
  return approvalsFromSettings(s);
}

const SLOT_KEY = 'oma.workspace.timetable.v1';

export async function listBrands(): Promise<BrandRef[]> {
  const res = await api<{ items?: BrandRef[]; data?: BrandRef[] } | BrandRef[]>(
    '/api/v1/brands?limit=50',
  );
  if (Array.isArray(res)) {
    return res.map((b) => ({ id: b.id, name: b.name, logo_url: b.logo_url ?? null }));
  }
  const rows = res.items || res.data || [];
  return rows.map((b) => ({ id: b.id, name: b.name, logo_url: b.logo_url ?? null }));
}

export async function listLabels(brandId: string): Promise<ContentLabel[]> {
  const res = await api<{ items?: ContentLabel[]; data?: ContentLabel[] } | ContentLabel[]>(
    `/api/v1/brands/${brandId}/content-labels`,
  );
  if (Array.isArray(res)) return res;
  return res.items || res.data || [];
}

export async function createLabel(
  brandId: string,
  input: { nameEn: string; nameAr?: string; color: string },
): Promise<ContentLabel> {
  return api(`/api/v1/brands/${brandId}/content-labels`, {
    method: 'POST',
    body: JSON.stringify({
      nameEn: input.nameEn,
      nameAr: input.nameAr || input.nameEn,
      color: input.color,
    }),
  });
}

export async function deleteLabel(brandId: string, labelId: string): Promise<void> {
  await api(`/api/v1/brands/${brandId}/content-labels/${labelId}`, {
    method: 'DELETE',
    body: '{}',
  });
}

export async function listTemplates(brandId: string): Promise<ContentTemplate[]> {
  const res = await api<
    { items?: ContentTemplate[]; data?: ContentTemplate[] } | ContentTemplate[]
  >(`/api/v1/brands/${brandId}/content-templates`);
  if (Array.isArray(res)) return res;
  return res.items || res.data || [];
}

export async function createTemplate(
  brandId: string,
  input: { nameEn: string; titleEn?: string; captionEn?: string },
): Promise<ContentTemplate> {
  return api(`/api/v1/brands/${brandId}/content-templates`, {
    method: 'POST',
    body: JSON.stringify({
      nameEn: input.nameEn,
      nameAr: input.nameEn,
      titleEn: input.titleEn,
      captionEn: input.captionEn,
    }),
  });
}

export async function deleteTemplate(brandId: string, templateId: string): Promise<void> {
  await api(`/api/v1/brands/${brandId}/content-templates/${templateId}`, {
    method: 'DELETE',
    body: '{}',
  });
}

export function loadTimeSlots(): TimeSlot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SLOT_KEY);
    return raw ? (JSON.parse(raw) as TimeSlot[]) : [];
  } catch {
    return [];
  }
}

export function saveTimeSlots(slots: TimeSlot[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SLOT_KEY, JSON.stringify(slots));
}
