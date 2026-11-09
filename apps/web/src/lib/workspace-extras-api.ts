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

export async function getBrandApprovalSettings(
  brandId: string,
): Promise<ApprovalSettings & { source: 'brand' | 'workspace' }> {
  const res = await api<{
    data: {
      approval_mode?: ApprovalMode;
      approval_policy?: string;
      approval_policy_source?: 'brand' | 'workspace';
      required_approvers?: number;
      schedule_on_approval?: boolean;
      lock_after_approval?: boolean;
      reminder_pending_approvals?: boolean;
    };
  }>(`/api/v1/brands/${brandId}/content-preferences`);
  const d = res.data;
  const mode: ApprovalMode =
    d.approval_mode === 'none' ||
    d.approval_mode === 'optional' ||
    d.approval_mode === 'required' ||
    d.approval_mode === 'multi_level'
      ? d.approval_mode
      : d.approval_policy === 'NONE'
        ? 'none'
        : d.approval_policy === 'REQUIRED'
          ? 'required'
          : 'optional';
  return {
    mode,
    requiredApprovers: d.required_approvers ?? 1,
    scheduleOnApproval: d.schedule_on_approval ?? false,
    lockAfterApproval: d.lock_after_approval ?? false,
    reminderPendingApprovals: d.reminder_pending_approvals ?? false,
    source: d.approval_policy_source === 'brand' ? 'brand' : 'workspace',
  };
}

export async function saveBrandApprovalSettings(
  brandId: string,
  a: ApprovalSettings,
): Promise<ApprovalSettings> {
  const required =
    a.mode === 'multi_level'
      ? Math.max(2, a.requiredApprovers)
      : a.mode === 'required'
        ? Math.max(1, a.requiredApprovers)
        : 1;
  const res = await api<{
    data: {
      approval_mode?: ApprovalMode;
      required_approvers?: number;
      schedule_on_approval?: boolean;
      lock_after_approval?: boolean;
      reminder_pending_approvals?: boolean;
    };
  }>(`/api/v1/brands/${brandId}/content-preferences`, {
    method: 'PATCH',
    body: JSON.stringify({
      approvalMode: a.mode,
      requiredApprovers: required,
      scheduleOnApproval: a.scheduleOnApproval,
      lockAfterApproval: a.lockAfterApproval,
      reminderPendingApprovals: a.reminderPendingApprovals,
    }),
  });
  const d = res.data;
  return {
    mode: d.approval_mode ?? a.mode,
    requiredApprovers: d.required_approvers ?? required,
    scheduleOnApproval: d.schedule_on_approval ?? a.scheduleOnApproval,
    lockAfterApproval: d.lock_after_approval ?? a.lockAfterApproval,
    reminderPendingApprovals: d.reminder_pending_approvals ?? a.reminderPendingApprovals,
  };
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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function timeSlotDayName(dow: number): string {
  return DAY_NAMES[((dow % 7) + 7) % 7]!;
}

export function timeSlotDayIndex(name: string): number {
  const i = DAY_NAMES.findIndex((d) => d.toLowerCase() === name.trim().toLowerCase());
  return i >= 0 ? i : 0;
}

type ApiTimeSlot = {
  id: string;
  day_of_week: number;
  time_local: string;
  color?: string | null;
  label?: string | null;
};

function fromApiSlot(row: ApiTimeSlot): TimeSlot {
  return {
    id: row.id,
    time: row.time_local,
    day: timeSlotDayName(row.day_of_week),
    color: row.color || '#fde68a',
  };
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

export async function listTimeSlots(): Promise<TimeSlot[]> {
  const res = await api<{ items?: ApiTimeSlot[] }>('/api/v1/workspace/time-slots');
  return (res.items ?? []).map(fromApiSlot);
}

export async function createTimeSlot(input: {
  time: string;
  day: string;
  color?: string;
}): Promise<TimeSlot> {
  const res = await api<ApiTimeSlot & { id: string }>('/api/v1/workspace/time-slots', {
    method: 'POST',
    body: JSON.stringify({
      day_of_week: timeSlotDayIndex(input.day),
      time_local: input.time,
      color: input.color ?? '#fde68a',
    }),
  });
  return fromApiSlot({
    id: res.id,
    day_of_week: timeSlotDayIndex(input.day),
    time_local: input.time,
    color: input.color ?? '#fde68a',
  });
}

export async function deleteTimeSlot(slotId: string): Promise<void> {
  await api(`/api/v1/workspace/time-slots/${slotId}`, { method: 'DELETE', body: '{}' });
}

/** Prefer the workspace API; migrate leftover localStorage slots once if the server list is empty. */
export async function syncTimeSlots(): Promise<TimeSlot[]> {
  const remote = await listTimeSlots();
  if (remote.length) {
    if (typeof window !== 'undefined') window.localStorage.removeItem(SLOT_KEY);
    return remote;
  }
  const local = loadTimeSlots();
  if (!local.length) return [];
  const migrated: TimeSlot[] = [];
  for (const slot of local) {
    try {
      migrated.push(await createTimeSlot(slot));
    } catch {
      migrated.push(slot);
    }
  }
  if (typeof window !== 'undefined') window.localStorage.removeItem(SLOT_KEY);
  return migrated;
}
