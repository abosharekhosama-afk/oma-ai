import { api, ensureCsrfToken, friendlyApiMessage, invalidateApiCache } from './api';

export type Profile = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  preferred_locale: 'en' | 'ar' | string;
  preferred_dir: string;
  two_factor_enabled?: boolean;
  deletion_scheduled_at?: string | null;
  deletion_purge_at?: string | null;
};

export type UserPreferences = {
  timezone: string;
  hourFormat?: '24h' | '12h';
  weekStart: 'monday' | 'sunday';
  twoFactorEnabled?: boolean;
  defaultContentView: 'list' | 'calendar' | 'feed' | 'grid';
  defaultTaskView: 'board' | 'list';
  reviewReminders: boolean;
  localePreference: 'en' | 'ar' | 'system';
  notifications: Record<string, boolean>;
  homeSetupDismissed?: boolean;
  campaignFavoriteIds?: string[];
};

export type TwoFactorSetupResponse = {
  secret: string;
  otpauth_uri: string;
  backup_codes: string[];
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

export async function changeMyPassword(input: {
  current_password?: string;
  new_password: string;
}): Promise<void> {
  await api('/api/v1/me/password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function setupTwoFactor(): Promise<TwoFactorSetupResponse> {
  const res = await api<{ data: TwoFactorSetupResponse }>('/api/v1/me/2fa/setup', {
    method: 'POST',
    body: '{}',
  });
  return res.data;
}

export async function verifyTwoFactor(code: string): Promise<{
  two_factor_enabled: boolean;
  backup_codes: string[];
}> {
  const res = await api<{
    data: { two_factor_enabled: boolean; backup_codes: string[] };
  }>('/api/v1/me/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  invalidateApiCache('/api/v1/me/profile');
  return res.data;
}

export async function disableTwoFactor(): Promise<{ two_factor_enabled: boolean }> {
  const res = await api<{ data: { two_factor_enabled: boolean } }>('/api/v1/me/2fa/disable', {
    method: 'POST',
    body: '{}',
  });
  invalidateApiCache('/api/v1/me/profile');
  return res.data;
}

export async function exportMyData(): Promise<Record<string, unknown>> {
  const res = await api<{ data: Record<string, unknown> }>('/api/v1/me/export');
  return res.data;
}

export async function scheduleAccountDeletion(): Promise<{
  scheduled: boolean;
  deletion_scheduled_at: string;
  deletion_purge_at: string;
  grace_period_days: number;
}> {
  const res = await api<{
    data: {
      scheduled: boolean;
      deletion_scheduled_at: string;
      deletion_purge_at: string;
      grace_period_days: number;
    };
  }>('/api/v1/me/account', {
    method: 'DELETE',
    body: '{}',
  });
  invalidateApiCache('/api/v1/me/profile');
  return res.data;
}

export async function cancelAccountDeletion(): Promise<{
  scheduled: boolean;
  deletion_scheduled_at: null;
  deletion_purge_at: null;
}> {
  const res = await api<{
    data: {
      scheduled: boolean;
      deletion_scheduled_at: null;
      deletion_purge_at: null;
    };
  }>('/api/v1/me/account/cancel-deletion', {
    method: 'POST',
    body: '{}',
  });
  invalidateApiCache('/api/v1/me/profile');
  return res.data;
}

export async function uploadAvatar(file: File): Promise<{ asset_id: string; avatar_url: string }> {
  const csrf = await ensureCsrfToken();
  const res = await fetch('/api/v1/me/avatar', {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
      'content-type': file.type,
      'x-file-name': encodeURIComponent(file.name),
    },
    body: file,
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: { asset_id: string; avatar_url: string };
    error?: { code?: string; message_key?: string };
  };
  if (!res.ok || !body.data) throw new Error(friendlyApiMessage(body.error, res.status));
  invalidateApiCache('/api/v1/me/profile');
  invalidateApiCache('/api/v1/auth/me');
  return body.data;
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
