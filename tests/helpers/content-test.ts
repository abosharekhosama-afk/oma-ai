import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { authHeaders, createBrand, seedBrandTenant, type BrandSeed } from './brand-test';

export type ContentRow = {
  id: string;
  status: string;
  approval_state: string;
  schedule_state: string;
  planned_at: string | null;
  scheduled_at: string | null;
  workflow: { publishDisplay: string; scheduleBlockedReason: string | null };
  schedule_readiness: { ready: boolean; blockers: Array<{ code: string }> } | null;
  calendar: { state: string; at: string | null };
  publishing: { skip_reason: string | null };
};

export type ApiResult<T = ContentRow> = {
  status: number;
  body: {
    data: T;
    auto_schedule?: { attempted: boolean; scheduled: boolean; blockers: Array<{ code: string }> };
    error?: { code: string; message_key: string; details: unknown[] };
  };
};

/** Small typed client for the content API used by Phase 2 integration tests. */
export function contentApi(seed: BrandSeed, headers?: Record<string, string>) {
  const call = async <T = ContentRow>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ApiResult<T>> => {
    const h = headers ?? (authHeaders(seed) as Record<string, string>);
    const res = await fetch(`${seed.baseUrl}/api/v1${path}`, {
      method,
      headers: method === 'GET' ? { cookie: h.cookie! } : h,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as ApiResult<T>['body'] };
  };
  return {
    call,
    create: (brandId: string, body: Record<string, unknown> = {}) =>
      call('POST', `/brands/${brandId}/content`, {
        title: { en: 'Launch post', ar: 'منشور الإطلاق' },
        caption: { en: 'We are live', ar: 'انطلقنا' },
        contentType: 'POST',
        channel: 'instagram',
        ...body,
      }),
    get: (id: string) => call('GET', `/content/${id}`),
    patch: (id: string, body: Record<string, unknown>) => call('PATCH', `/content/${id}`, body),
    act: (id: string, action: string, body: Record<string, unknown> = {}) =>
      call('POST', `/content/${id}/${action}`, body),
    readiness: (id: string) =>
      call<{ ready: boolean; blockers: Array<{ code: string }>; calendar: { state: string } }>(
        'GET',
        `/content/${id}/schedule-readiness`,
      ),
    prefs: (brandId: string, body: Record<string, unknown>) =>
      call('PATCH', `/brands/${brandId}/content-preferences`, body),
    targets: (id: string, socialPageIds: string[]) =>
      call('POST', `/content/${id}/publish-target`, { socialPageIds }),
    list: (brandId: string, query = '') =>
      call<ContentRow[]>('GET', `/brands/${brandId}/content${query}`),
    attachTestMedia: async (brandId: string, contentId: string) => {
      const assetId = newId();
      await getPrisma().mediaAsset.create({
        data: {
          id: assetId,
          tenantId: seed.tenantId,
          brandId,
          kind: 'IMAGE',
          workdriveFileId: `wd-test-${assetId.slice(-8)}`,
          name: 'post-test.jpg',
          mime: 'image/jpeg',
          size: BigInt(2048),
          createdBy: seed.userId,
        },
      });
      return call('PATCH', `/content/${contentId}`, { media_asset_ids: [assetId] });
    },
  };
}

/** JPEG asset valid for Instagram/Facebook schedule-readiness checks in integration tests. */
export async function seedContentImageAsset(seed: BrandSeed, brandId: string): Promise<string> {
  const assetId = newId();
  await getPrisma().mediaAsset.create({
    data: {
      id: assetId,
      tenantId: seed.tenantId,
      brandId,
      kind: 'IMAGE',
      workdriveFileId: `wd-test-${assetId.slice(-8)}`,
      name: 'post-test.jpg',
      mime: 'image/jpeg',
      size: BigInt(2048),
      createdBy: seed.userId,
    },
  });
  return assetId;
}

export async function seedSocialPage(
  seed: BrandSeed,
  brandId: string,
  over: { network?: 'INSTAGRAM' | 'FACEBOOK' | 'X' | 'LINKEDIN' | 'TIKTOK'; status?: string } = {},
) {
  const id = newId();
  await getPrisma().socialPage.create({
    data: {
      id,
      tenantId: seed.tenantId,
      brandId,
      network: over.network ?? 'INSTAGRAM',
      externalId: `ext-${id.slice(-8)}`,
      name: 'Brand account',
      accessTokenEnc: 'test-token',
      connectedBy: seed.userId,
      ...(over.status ? { status: over.status as never } : {}),
    },
  });
  return id;
}

export async function seedContentBrand() {
  const seed = await seedBrandTenant();
  const { body } = await createBrand(seed);
  return { seed, brandId: body.data.id as string, api: contentApi(seed) };
}

export const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
