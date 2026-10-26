import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  encryptToken,
  newId,
  parseEncryptionKey,
  SocialProviderError,
  type SocialProviderAdapter,
} from '@oma/domain';
import {
  addBrandMember,
  authHeaders,
  createBrand,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
  grantCapability,
} from '../helpers/brand-test';
import { cookieHeader } from '../helpers/app';
import {
  MAX_PUBLISH_ATTEMPTS,
  PUBLISH_BACKOFF_MS,
  runPublishTick,
  runTokenRefreshTick,
} from '../../apps/worker/src/social/social-jobs';

const KEY = parseEncryptionKey('c'.repeat(64))!;

type Seed = Awaited<ReturnType<typeof seedBrandTenant>>;
type Member = Awaited<ReturnType<typeof seedMemberWithoutBrandCaps>>;

function as(seed: Seed, m: Member) {
  return (path: string, init: RequestInit = {}) =>
    fetch(`${seed.baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(m.cookies),
        'x-csrf-token': m.csrf,
      },
    });
}
const rows = (body: { data: unknown }) =>
  (Array.isArray(body.data)
    ? body.data
    : ((body.data as { items: unknown[] }).items ?? [])) as Array<{ id: string }>;

async function seedPost(seed: Seed, brandId: string, over: Record<string, unknown> = {}) {
  const id = newId();
  await getPrisma().contentItem.create({
    data: {
      id,
      tenantId: seed.tenantId,
      brandId,
      titleEn: 'Launch post',
      titleAr: 'منشور الإطلاق',
      captionEn: 'We are live',
      contentType: 'POST',
      channel: 'x',
      track: 'ORGANIC',
      status: 'SCHEDULED',
      approvalState: 'APPROVED',
      scheduleState: 'SCHEDULED',
      scheduledAt: new Date(Date.now() - 60_000),
      createdBy: seed.userId,
      ...over,
    },
  });
  return id;
}

async function seedPage(seed: Seed, brandId: string, over: Record<string, unknown> = {}) {
  const id = newId();
  await getPrisma().socialPage.create({
    data: {
      id,
      tenantId: seed.tenantId,
      brandId,
      network: 'X',
      externalId: `ext-${id.slice(-6)}`,
      name: 'Brand on X',
      accessTokenEnc: encryptToken('access-1', KEY),
      refreshTokenEnc: encryptToken('refresh-1', KEY),
      connectedBy: seed.userId,
      metaJson: JSON.stringify({ username: 'brand' }),
      ...over,
    },
  });
  return id;
}

describe('brand membership isolation + lifecycle', () => {
  let seed: Seed;
  let brandA: string;
  let brandB: string;
  let outsider: Member;
  let viewer: Member;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    brandA = (await createBrand(seed, 'Alpha')).body.data.id as string;
    brandB = (await createBrand(seed, 'Beta')).body.data.id as string;
    outsider = await seedMemberWithoutBrandCaps(seed, { brands: [] });
    viewer = await seedMemberWithoutBrandCaps(seed, { brands: [brandA], role: 'VIEWER' });
    for (const m of [outsider, viewer])
      for (const code of ['brand.read', 'brand.create', 'content.update'])
        await grantCapability(seed.tenantId, m.membershipId, code, seed.userId);
  });
  afterAll(async () => {
    await seed?.app.close();
  });

  it('a workspace member without brand access sees no brands and gets 404 on direct access', async () => {
    const list = await as(seed, outsider)('/api/v1/brands');
    expect(list.status).toBe(200);
    expect(rows(await list.json())).toHaveLength(0);
    expect((await as(seed, outsider)(`/api/v1/brands/${brandA}`)).status).toBe(404);
    expect((await as(seed, outsider)(`/api/v1/brands/${brandA}/social-pages`)).status).toBe(404);
  });

  it('a brand member only sees their brand; the role narrows what they can do', async () => {
    const list = rows(await (await as(seed, viewer)('/api/v1/brands')).json());
    expect(list.map((b) => b.id)).toEqual([brandA]);
    expect((await as(seed, viewer)(`/api/v1/brands/${brandB}`)).status).toBe(404);
    const get = await (await as(seed, viewer)(`/api/v1/brands/${brandA}`)).json();
    expect(get.data.access.role).toBe('VIEWER');
    expect(get.data.access.capabilities).not.toContain('content.update');
    const rename = await as(seed, viewer)(`/api/v1/brands/${brandA}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Nope', version: get.data.version }),
    });
    expect(rename.status).toBe(403);
    // Upgrading the role unlocks it.
    await addBrandMember(seed.tenantId, brandA, viewer.userId, 'MANAGER');
    const ok = await as(seed, viewer)(`/api/v1/brands/${brandA}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Alpha Coffee',
        timezone: 'Asia/Jerusalem',
        version: get.data.version,
      }),
    });
    expect(ok.status).toBe(200);
    const after = await (await as(seed, viewer)(`/api/v1/brands/${brandA}`)).json();
    expect(after.data).toMatchObject({ name: 'Alpha Coffee', timezone: 'Asia/Jerusalem' });
    const prefs = await getPrisma().contentPreferences.findFirst({ where: { brandId: brandA } });
    expect(prefs?.defaultTimezone).toBe('Asia/Jerusalem');
  });

  it('rejects invalid rename input', async () => {
    const v = (
      await (
        await fetch(`${seed.baseUrl}/api/v1/brands/${brandB}`, { headers: authHeaders(seed) })
      ).json()
    ).data.version;
    for (const body of [
      { name: '', version: v },
      { name: 'x'.repeat(200), version: v },
      { status: 'ACTIVE', version: v },
    ]) {
      const r = await fetch(`${seed.baseUrl}/api/v1/brands/${brandB}`, {
        method: 'PATCH',
        headers: authHeaders(seed),
        body: JSON.stringify(body),
      });
      expect(r.status).toBe(400);
    }
  });

  it('members API: add, change role, and keeps at least one manager', async () => {
    const add = await fetch(`${seed.baseUrl}/api/v1/brands/${brandB}/members`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ user_id: outsider.userId, role: 'APPROVER' }),
    });
    expect(add.status).toBe(201);
    expect((await as(seed, outsider)(`/api/v1/brands/${brandB}`)).status).toBe(200);
    const list = await (
      await fetch(`${seed.baseUrl}/api/v1/brands/${brandB}/members`, { headers: authHeaders(seed) })
    ).json();
    expect(JSON.stringify(list)).toContain(outsider.userId);
    const del = await fetch(`${seed.baseUrl}/api/v1/brands/${brandB}/members/${outsider.userId}`, {
      method: 'DELETE',
      headers: authHeaders(seed),
    });
    expect([200, 204]).toContain(del.status);
    expect((await as(seed, outsider)(`/api/v1/brands/${brandB}`)).status).toBe(404);
  });

  it('archive unschedules pending posts; unarchive; delete hides; purge removes', async () => {
    const pending = await seedPost(seed, brandB, { scheduledAt: new Date(Date.now() + 86400_000) });
    const done = await seedPost(seed, brandB, { publishState: 'PUBLISHED' });
    const v = (
      await (
        await fetch(`${seed.baseUrl}/api/v1/brands/${brandB}`, { headers: authHeaders(seed) })
      ).json()
    ).data.version;
    const arch = await fetch(`${seed.baseUrl}/api/v1/brands/${brandB}/archive`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ version: v }),
    });
    expect(arch.status).toBe(201);
    expect((await arch.json()).data.unscheduled_posts).toBe(1);
    const p = await getPrisma().contentItem.findUniqueOrThrow({ where: { id: pending } });
    expect(p.scheduleState).toBe('UNSCHEDULED');
    expect(p.scheduledAt).toBeNull();
    expect(
      (await getPrisma().contentItem.findUniqueOrThrow({ where: { id: done } })).publishState,
    ).toBe('PUBLISHED');

    const un = await fetch(`${seed.baseUrl}/api/v1/brands/${brandB}/unarchive`, {
      method: 'POST',
      headers: authHeaders(seed),
    });
    expect(un.status).toBe(201);
    expect(
      (await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandB } })).status,
    ).not.toBe('ARCHIVED');

    await seedPage(seed, brandB);
    const del = await fetch(`${seed.baseUrl}/api/v1/brands/${brandB}`, {
      method: 'DELETE',
      headers: authHeaders(seed),
    });
    expect(del.status).toBe(200);
    const list = rows(
      await (await fetch(`${seed.baseUrl}/api/v1/brands`, { headers: authHeaders(seed) })).json(),
    );
    expect(list.map((b) => b.id)).not.toContain(brandB);
    expect(
      (await getPrisma().socialPage.findFirstOrThrow({ where: { brandId: brandB } })).status,
    ).toBe('DISCONNECTED');
    const deleted = await (
      await fetch(`${seed.baseUrl}/api/v1/brands/-/deleted`, { headers: authHeaders(seed) })
    ).json();
    expect(JSON.stringify(deleted)).toContain(brandB);

    const wrong = await fetch(`${seed.baseUrl}/api/v1/brands/${brandB}/purge`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ confirm_name: 'wrong' }),
    });
    expect(wrong.status).toBe(400);
    const purge = await fetch(`${seed.baseUrl}/api/v1/brands/${brandB}/purge`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ confirm_name: 'Beta' }),
    });
    expect(purge.status).toBe(201);
    expect(await getPrisma().brandWorkspace.findUnique({ where: { id: brandB } })).toBeNull();
    expect(await getPrisma().contentItem.count({ where: { brandId: brandB } })).toBe(0);
    expect(await getPrisma().socialPage.count({ where: { brandId: brandB } })).toBe(0);
  });

  it('social providers report "not available" without keys and refuse to start', async () => {
    const r = await (
      await fetch(`${seed.baseUrl}/api/v1/brands/${brandA}/social-pages`, {
        headers: authHeaders(seed),
      })
    ).json();
    expect(r.data.pages).toEqual([]);
    expect(r.data.providers.every((p: { available: boolean }) => !p.available)).toBe(true);
    const start = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandA}/social-pages/oauth/x/start`,
      {
        method: 'POST',
        headers: authHeaders(seed),
      },
    );
    expect(start.status).toBe(409);
  });
});

describe('publish + refresh jobs', () => {
  let seed: Seed;
  let brand: string;
  beforeAll(async () => {
    seed = await seedBrandTenant();
    brand = (await createBrand(seed, 'Publisher')).body.data.id as string;
  });
  afterAll(async () => {
    await seed?.app.close();
  });

  function adapter(
    publish: SocialProviderAdapter['publish'],
    refresh?: SocialProviderAdapter['refresh'],
  ) {
    return () =>
      ({
        network: 'x',
        usesPkce: true,
        isConfigured: () => true,
        authorizeUrl: () => '',
        exchangeCode: async () => [],
        refresh: refresh ?? (async () => null),
        publish,
      }) as SocialProviderAdapter;
  }

  it('publishes an approved due post and stores the external URL', async () => {
    const page = await seedPage(seed, brand);
    const post = await seedPost(seed, brand, { socialPageId: page, publishState: 'QUEUED' });
    const seen: string[] = [];
    const out = await runPublishTick({
      key: KEY,
      adapterFor: adapter(async (p, input) => {
        seen.push(`${p.accessToken}|${input.text}`);
        return { externalId: '1001', url: 'https://x.com/brand/status/1001' };
      }),
    });
    expect(out.published).toBeGreaterThanOrEqual(1);
    expect(seen).toContain('access-1|We are live');
    const row = await getPrisma().contentItem.findUniqueOrThrow({ where: { id: post } });
    expect(row).toMatchObject({
      publishState: 'PUBLISHED',
      externalPostUrl: 'https://x.com/brand/status/1001',
      publishAttempts: 1,
    });
  });

  it('does not publish unapproved posts', async () => {
    const page = await seedPage(seed, brand);
    const post = await seedPost(seed, brand, { socialPageId: page, approvalState: 'PENDING' });
    await runPublishTick({
      key: KEY,
      adapterFor: adapter(async () => ({ externalId: 'n', url: null })),
    });
    expect(
      (await getPrisma().contentItem.findUniqueOrThrow({ where: { id: post } })).publishState,
    ).toBe('NONE');
  });

  it('retries transient errors with backoff, then fails after the max attempts', async () => {
    const page = await seedPage(seed, brand);
    const post = await seedPost(seed, brand, { socialPageId: page, publishState: 'QUEUED' });
    const failing = adapter(async () => {
      throw new SocialProviderError('X: Service Unavailable', { retryable: true });
    });
    let now = new Date();
    for (let i = 1; i <= MAX_PUBLISH_ATTEMPTS; i++) {
      await runPublishTick({ key: KEY, now: () => now, adapterFor: failing });
      const row = await getPrisma().contentItem.findUniqueOrThrow({ where: { id: post } });
      expect(row.publishAttempts).toBe(i);
      expect(row.lastPublishError).toContain('Service Unavailable');
      if (i < MAX_PUBLISH_ATTEMPTS) {
        expect(row.publishState).toBe('QUEUED');
        expect(row.nextPublishAt!.getTime() - now.getTime()).toBe(
          PUBLISH_BACKOFF_MS[Math.min(i - 1, 3)],
        );
        // Not retried before the backoff elapses.
        await runPublishTick({
          key: KEY,
          now: () => new Date(now.getTime() + 1000),
          adapterFor: failing,
        });
        expect(
          (await getPrisma().contentItem.findUniqueOrThrow({ where: { id: post } }))
            .publishAttempts,
        ).toBe(i);
        now = new Date(row.nextPublishAt!.getTime() + 1);
      } else {
        expect(row.publishState).toBe('FAILED');
        expect(row.nextPublishAt).toBeNull();
      }
    }
  });

  it('an expired grant marks the account for reconnect and alerts managers', async () => {
    const page = await seedPage(seed, brand);
    const post = await seedPost(seed, brand, { socialPageId: page, publishState: 'QUEUED' });
    await runPublishTick({
      key: KEY,
      adapterFor: adapter(async () => {
        throw new SocialProviderError('X: Unauthorized', { retryable: false, reauth: true });
      }),
    });
    expect(
      (await getPrisma().contentItem.findUniqueOrThrow({ where: { id: post } })).publishState,
    ).toBe('FAILED');
    expect((await getPrisma().socialPage.findUniqueOrThrow({ where: { id: page } })).status).toBe(
      'NEEDS_REAUTH',
    );
    const alerts = await getPrisma().notification.findMany({
      where: { tenantId: seed.tenantId, type: 'social.disconnected' },
    });
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });

  it('refreshes tokens nearing expiry and stores them encrypted', async () => {
    const page = await seedPage(seed, brand, { tokenExpiresAt: new Date(Date.now() + 3600_000) });
    await runTokenRefreshTick({
      key: KEY,
      adapterFor: adapter(
        async () => ({ externalId: '', url: null }),
        async () => ({
          accessToken: 'access-2',
          refreshToken: 'refresh-2',
          expiresAt: new Date(Date.now() + 7200_000),
        }),
      ),
    });
    const row = await getPrisma().socialPage.findUniqueOrThrow({ where: { id: page } });
    expect(row.accessTokenEnc).not.toContain('access-2');
    expect(row.status).toBe('CONNECTED');
    expect(row.tokenExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 3600_000);
  });
});
