import { api, invalidateApiCache } from './api';
import type { BrandDetail } from './brand-types';

export type BrandRole = 'MANAGER' | 'EDITOR' | 'APPROVER' | 'VIEWER';
export const BRAND_ROLES: BrandRole[] = ['MANAGER', 'EDITOR', 'APPROVER', 'VIEWER'];

export type BrandMemberRow = {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: BrandRole;
  workspace_admin: boolean;
  added_at: string | null;
};
export type BrandMemberCandidate = Pick<
  BrandMemberRow,
  'user_id' | 'name' | 'email' | 'avatar_url'
>;

export type SocialNetwork = 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'x';
export const SOCIAL_NETWORKS: SocialNetwork[] = [
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
  'x',
];

export type SocialPageRow = {
  id: string;
  brand_id: string;
  network: SocialNetwork;
  external_id: string;
  name: string;
  avatar_url: string | null;
  status: 'CONNECTED' | 'NEEDS_REAUTH' | 'ERROR' | 'DISCONNECTED';
  token_expires_at: string | null;
  last_error: string | null;
  connected_at: string;
};
export type SocialProvider = {
  network: SocialNetwork;
  available: boolean;
  reason: 'not_configured' | 'encryption_key_missing' | null;
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const bust = (brandId: string) => {
  invalidateApiCache(`/api/v1/brands/${brandId}`);
  invalidateApiCache('/api/v1/brands');
  invalidateApiCache('/api/v1/home');
};

export const brandSettingsApi = {
  get: (brandId: string) => api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`),
  update: async (
    brandId: string,
    patch: {
      name?: string;
      logoUrl?: string | null;
      logo_asset_id?: string | null;
      timezone?: string;
      version: number;
    },
  ) => {
    const r = await api<{
      data: { version: number; name: string; logo_url: string | null; timezone: string };
    }>(`/api/v1/brands/${brandId}`, json('PATCH', patch));
    bust(brandId);
    return r;
  },
  archive: async (brandId: string, version: number) => {
    const r = await api<{ data: { unscheduled_posts: number } }>(
      `/api/v1/brands/${brandId}/archive`,
      json('POST', { version }),
    );
    bust(brandId);
    return r;
  },
  unarchive: async (brandId: string) => {
    const r = await api(`/api/v1/brands/${brandId}/unarchive`, json('POST', {}));
    bust(brandId);
    return r;
  },
  remove: async (brandId: string) => {
    const r = await api<{ data: { unscheduled_posts: number } }>(
      `/api/v1/brands/${brandId}`,
      json('DELETE'),
    );
    bust(brandId);
    return r;
  },
  members: (brandId: string) =>
    api<{ data: { members: BrandMemberRow[]; available: BrandMemberCandidate[] } }>(
      `/api/v1/brands/${brandId}/members`,
    ),
  addMember: async (brandId: string, userId: string, role: BrandRole) => {
    const r = await api(`/api/v1/brands/${brandId}/members`, json('POST', { userId, role }));
    invalidateApiCache(`/api/v1/brands/${brandId}/members`);
    return r;
  },
  setRole: async (brandId: string, userId: string, role: BrandRole) => {
    const r = await api(`/api/v1/brands/${brandId}/members/${userId}`, json('PATCH', { role }));
    invalidateApiCache(`/api/v1/brands/${brandId}/members`);
    return r;
  },
  removeMember: async (brandId: string, userId: string) => {
    const r = await api(`/api/v1/brands/${brandId}/members/${userId}`, json('DELETE'));
    invalidateApiCache(`/api/v1/brands/${brandId}/members`);
    return r;
  },
  social: (brandId: string) =>
    api<{ data: { pages: SocialPageRow[]; providers: SocialProvider[] } }>(
      `/api/v1/brands/${brandId}/social-pages`,
    ),
  connect: (brandId: string, network: SocialNetwork) =>
    api<{ data: { authorize_url: string } }>(
      `/api/v1/brands/${brandId}/social-pages/oauth/${network}/start`,
      json('POST', {}),
    ),
  disconnect: async (brandId: string, pageId: string) => {
    const r = await api(`/api/v1/social-pages/${pageId}`, json('DELETE'));
    invalidateApiCache(`/api/v1/brands/${brandId}/social-pages`);
    invalidateApiCache('/api/v1/home');
    return r;
  },
};

/** Read an image file as a data URL for the logo field (PNG/JPEG/WebP/GIF, ≤ 200 KB). */
export function readLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return reject(new Error('type'));
    if (file.size > 200 * 1024) return reject(new Error('size'));
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
}

export function timezoneOptions(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  return (
    intl.supportedValuesOf?.('timeZone') ?? ['Asia/Dubai', 'Asia/Jerusalem', 'Europe/London', 'UTC']
  );
}
