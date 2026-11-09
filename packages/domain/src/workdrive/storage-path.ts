/**
 * Path isolation for platform-master (OMA_INTERNAL) storage.
 * Never interpolate user-supplied folder names into the tenant prefix.
 */

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function assertSafeStorageSegment(value: string, label = 'id'): string {
  const v = value.trim();
  if (!SAFE_ID.test(v) || v.includes('..')) {
    throw new Error(`Invalid ${label} for storage path`);
  }
  return v;
}

/** `tenants/{tenantId}/brands/{brandId}/{kind}` (avatars: `tenants/{tenantId}/avatars/{userId}`). */
export function internalMediaSegments(input: {
  tenantId: string;
  brandId?: string | null;
  kind: string;
  userId?: string;
}): string[] {
  const tenantId = assertSafeStorageSegment(input.tenantId, 'tenantId');
  if (input.kind === 'avatars') {
    const userId = assertSafeStorageSegment(input.userId || 'user', 'userId');
    return ['tenants', tenantId, 'avatars', userId];
  }
  const brandId = assertSafeStorageSegment(input.brandId || 'workspace', 'brandId');
  const kind = assertSafeStorageSegment(input.kind, 'kind');
  return ['tenants', tenantId, 'brands', brandId, kind];
}

export function storagePathOf(segments: string[]): string {
  return segments.join('/');
}

/** Reject traversal and any path that addresses a different tenant tree. */
export function assertPathBelongsToTenant(segments: string[], tenantId: string): string[] {
  const expected = assertSafeStorageSegment(tenantId, 'tenantId');
  for (const raw of segments) {
    const s = String(raw);
    if (!s || s === '..' || s.includes('/') || s.includes('\\')) {
      throw new Error('Storage path traversal is not allowed');
    }
  }
  if (segments[0] === 'tenants' && segments[1] && segments[1] !== expected) {
    throw new Error('Storage path does not belong to this workspace');
  }
  return segments;
}
