/**
 * Aligns Planable-style request UI with production WorkRequestStatus:
 * OPEN | ASSIGNED | IN_PROGRESS | BLOCKED | DONE | CANCELLED
 */

export const API_REQUEST_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'BLOCKED',
  'DONE',
  'CANCELLED',
] as const;

export type ApiRequestStatus = (typeof API_REQUEST_STATUSES)[number];

/** Map any UI/demo status → API enum value */
export function toApiRequestStatus(status: string): ApiRequestStatus {
  const s = (status || 'OPEN').toUpperCase();
  if (s === 'WAITING_INFO' || s === 'BLOCKED') return 'BLOCKED';
  if (
    s === 'IN_BRIEF' ||
    s === 'READY_FOR_PRODUCTION' ||
    s === 'IN_PRODUCTION' ||
    s === 'IN_PROGRESS'
  ) {
    return 'IN_PROGRESS';
  }
  if (s === 'CLOSED' || s === 'CANCELLED') return 'CANCELLED';
  if (s === 'DONE') return 'DONE';
  if (s === 'ASSIGNED') return 'ASSIGNED';
  if (s === 'OPEN') return 'OPEN';
  return 'OPEN';
}

/** Map API status → UI row status */
export function fromApiRequestStatus(status: string): string {
  const s = (status || 'OPEN').toUpperCase();
  if (s === 'BLOCKED') return 'WAITING_INFO';
  if (s === 'CANCELLED') return 'CLOSED';
  if (s === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (s === 'ASSIGNED') return 'ASSIGNED';
  if (s === 'DONE') return 'DONE';
  if (s === 'OPEN') return 'OPEN';
  return s;
}

export const API_REQUEST_TRANSITIONS: Record<ApiRequestStatus, ApiRequestStatus[]> = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['BLOCKED', 'DONE', 'CANCELLED'],
  BLOCKED: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
};

export function canTransitionApiRequestStatus(from: string, to: string): boolean {
  const f = toApiRequestStatus(from);
  const t = toApiRequestStatus(to);
  if (f === t) return true;
  return API_REQUEST_TRANSITIONS[f]?.includes(t) ?? false;
}

export function allowedNextStatuses(from: string): ApiRequestStatus[] {
  const f = toApiRequestStatus(from);
  return [f, ...(API_REQUEST_TRANSITIONS[f] ?? [])];
}

export function canConvertRequest(status: string): boolean {
  const s = toApiRequestStatus(status);
  return s === 'OPEN' || s === 'ASSIGNED' || s === 'IN_PROGRESS' || s === 'BLOCKED';
}

export function canCloseRequest(status: string): boolean {
  return toApiRequestStatus(status) !== 'CANCELLED' && toApiRequestStatus(status) !== 'DONE';
}

export function statusLabel(status: string, isAr: boolean): string {
  const s = toApiRequestStatus(status);
  const map: Record<ApiRequestStatus, { en: string; ar: string }> = {
    OPEN: { en: 'Open', ar: 'مفتوح' },
    ASSIGNED: { en: 'Assigned', ar: 'مُسند' },
    IN_PROGRESS: { en: 'In progress', ar: 'قيد التنفيذ' },
    BLOCKED: { en: 'Waiting / blocked', ar: 'بانتظار معلومات' },
    DONE: { en: 'Done', ar: 'مكتمل' },
    CANCELLED: { en: 'Closed', ar: 'مغلق' },
  };
  return isAr ? map[s].ar : map[s].en;
}

export function priorityLabel(priority: string, isAr: boolean): string {
  const p = (priority || 'MEDIUM').toUpperCase();
  const map: Record<string, { en: string; ar: string }> = {
    LOW: { en: 'Low', ar: 'منخفضة' },
    MEDIUM: { en: 'Medium', ar: 'متوسطة' },
    HIGH: { en: 'High', ar: 'عالية' },
    URGENT: { en: 'Urgent', ar: 'عاجلة' },
  };
  return isAr ? (map[p]?.ar ?? p) : (map[p]?.en ?? p);
}
