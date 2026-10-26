import { DomainError } from '@oma/domain';
import { isValidTimezone } from '../common/zoned-time';

/** Validated brand settings input (rename / logo / timezone). Unknown keys are rejected. */
export type BrandSettingsInput = {
  name?: string;
  logoUrl?: string | null;
  timezone?: string;
  version: number;
};

const ALLOWED = new Set(['name', 'logoUrl', 'logo_url', 'timezone', 'version']);
const MAX_LOGO_DATA_URL = 280_000; // ≈ 200 KB image
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

function bad(field: string, message: string): never {
  throw new DomainError('VALIDATION_FAILED', message, 400, 'errors.validation_failed', [{ field }]);
}

export function parseBrandName(v: unknown, field = 'name'): string {
  if (typeof v !== 'string') bad(field, 'name must be a string');
  const name = v.trim().replace(/\s+/g, ' ');
  if (!name) bad(field, 'name is required');
  if (name.length > 120) bad(field, 'name must be at most 120 characters');
  if (CONTROL.test(name)) bad(field, 'name contains invalid characters');
  return name;
}

export function parseLogoUrl(v: unknown): string | null {
  if (v === null || v === '') return null;
  if (typeof v !== 'string') bad('logoUrl', 'logoUrl must be a string or null');
  const s = v.trim();
  if (s.startsWith('data:')) {
    if (!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s)) {
      bad('logoUrl', 'logo must be a PNG, JPEG, WebP or GIF image');
    }
    if (s.length > MAX_LOGO_DATA_URL) bad('logoUrl', 'logo must be at most 200 KB');
    return s;
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    bad('logoUrl', 'logoUrl must be a valid URL');
  }
  if (u.protocol !== 'https:') bad('logoUrl', 'logoUrl must use https');
  if (s.length > 2048) bad('logoUrl', 'logoUrl is too long');
  return u.toString();
}

export function parseTimezone(v: unknown): string {
  if (typeof v !== 'string' || !isValidTimezone(v.trim())) {
    bad('timezone', 'timezone must be a valid IANA timezone');
  }
  return v.trim();
}

export function parseBrandSettings(body: unknown, ifMatch?: string): BrandSettingsInput {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    bad('body', 'body must be an object');
  const b = body as Record<string, unknown>;
  for (const k of Object.keys(b)) if (!ALLOWED.has(k)) bad(k, `unknown field ${k}`);
  const version = b.version ?? (ifMatch ? Number(ifMatch.replace(/"/g, '')) : undefined);
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    bad('version', 'version is required');
  }
  const out: BrandSettingsInput = { version };
  if (b.name !== undefined) out.name = parseBrandName(b.name);
  const logo = b.logoUrl !== undefined ? b.logoUrl : b.logo_url;
  if (logo !== undefined) out.logoUrl = parseLogoUrl(logo);
  if (b.timezone !== undefined) out.timezone = parseTimezone(b.timezone);
  return out;
}
