import { api } from './api';

export type BrandRef = { id: string; name: string };

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

export type ApprovalSettings = {
  mode: 'none' | 'optional' | 'required' | 'multi_level';
  scheduleOnApproval: boolean;
  lockAfterApproval: boolean;
};

const SLOT_KEY = 'oma.workspace.timetable.v1';
const APPROVAL_KEY = 'oma.workspace.approvals.v1';

export async function listBrands(): Promise<BrandRef[]> {
  const res = await api<{ items?: BrandRef[]; data?: BrandRef[] } | BrandRef[]>('/api/v1/brands?limit=50');
  if (Array.isArray(res)) return res.map((b) => ({ id: b.id, name: b.name }));
  const rows = res.items || res.data || [];
  return rows.map((b) => ({ id: b.id, name: b.name }));
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
  const res = await api<{ items?: ContentTemplate[]; data?: ContentTemplate[] } | ContentTemplate[]>(
    `/api/v1/brands/${brandId}/content-templates`,
  );
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

export function loadApprovalSettings(): ApprovalSettings {
  if (typeof window === 'undefined') {
    return { mode: 'optional', scheduleOnApproval: false, lockAfterApproval: false };
  }
  try {
    const raw = window.localStorage.getItem(APPROVAL_KEY);
    if (raw) return JSON.parse(raw) as ApprovalSettings;
  } catch {
    /* ignore */
  }
  return { mode: 'optional', scheduleOnApproval: false, lockAfterApproval: false };
}

export function saveApprovalSettings(settings: ApprovalSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(APPROVAL_KEY, JSON.stringify(settings));
}
