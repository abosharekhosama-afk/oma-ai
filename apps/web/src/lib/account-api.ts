import { api, invalidateApiCache } from './api';

export type Profile = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  preferred_locale: 'en' | 'ar' | string;
  preferred_dir: string;
};

export type UserPreferences = {
  timezone: string;
  weekStart: 'monday' | 'sunday';
  defaultContentView: 'list' | 'calendar' | 'feed' | 'grid';
  defaultTaskView: 'board' | 'list';
  reviewReminders: boolean;
  localePreference: 'en' | 'ar' | 'system';
  notifications: Record<string, boolean>;
  homeSetupDismissed?: boolean;
};

export const NOTIFICATION_PREF_TYPES = [
  'content.approval_requested',
  'content.approved',
  'content.changes_requested',
  'content.rejected',
  'content.comment',
  'content.publish.succeeded',
  'content.publish.failed',
  'deliverable.review',
  'deliverable.approved',
  'deliverable.changes_requested',
  'deliverable.rejected',
  'deliverable.comment',
  'task.assigned',
  'task.comment',
] as const;

export async function getProfile(): Promise<Profile> {
  return (await api<{ data: Profile }>('/api/v1/me/profile')).data;
}

export async function updateProfile(patch: {
  name?: string;
  avatarUrl?: string | null;
  preferredLocale?: 'en' | 'ar';
}): Promise<Profile> {
  const res = await api<{ data: Profile }>('/api/v1/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  invalidateApiCache('/api/v1/auth/me');
  return res.data;
}

export async function getPreferences(): Promise<UserPreferences> {
  return (await api<{ data: UserPreferences }>('/api/v1/me/preferences')).data;
}

export async function updatePreferences(patch: Partial<UserPreferences>): Promise<UserPreferences> {
  return (
    await api<{ data: UserPreferences }>('/api/v1/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  ).data;
}

export async function refreshSession(): Promise<string | null> {
  const res = await api<{ data: { expires_at: string } }>('/api/v1/auth/session/refresh', {
    method: 'POST',
    body: '{}',
  });
  return res.data?.expires_at ?? null;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api('/api/v1/auth/recovery/request', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  await api('/api/v1/auth/recovery/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

/** Persist the UI language (cookie drives SSR lang/dir) and, when signed in, the account. */
export function setLocaleCookie(locale: 'en' | 'ar') {
  document.cookie = `oma_locale=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/** Only allow same-origin in-app return paths (prevents open redirects). */
export function safeReturnPath(next: string | null | undefined): string {
  if (!next) return '/app';
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/app';
  if (!next.startsWith('/app')) return '/app';
  return next;
}

export function initials(name: string | null | undefined): string {
  const parts = String(name ?? '')
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}
