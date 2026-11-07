import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { authHeaders, seedBrandTenant, seedMemberWithoutBrandCaps } from '../helpers/brand-test';

const databaseUrl = process.env.DATABASE_URL ?? '';
const localDatabase = /localhost|127\.0\.0\.1/.test(databaseUrl);
const apps: Array<{ close: () => Promise<void> }> = [];

describe.skipIf(!localDatabase)('listening rule management integration', () => {
  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close().catch(() => undefined)));
    await getPrisma()
      .$disconnect()
      .catch(() => undefined);
  });

  it('creates, edits, pauses, isolates, and refuses viewers without exposing credentials', async () => {
    const previousYoutube = process.env.YOUTUBE_API_KEY;
    const previousCseKey = process.env.GOOGLE_CSE_API_KEY;
    const previousCseCx = process.env.GOOGLE_CSE_CX;
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.GOOGLE_CSE_API_KEY;
    delete process.env.GOOGLE_CSE_CX;

    const owner = await seedBrandTenant();
    apps.push(owner.app);
    const other = await seedBrandTenant();
    apps.push(other.app);
    const viewer = await seedMemberWithoutBrandCaps(owner, { brands: [] });
    await getPrisma().capabilityGrant.deleteMany({
      where: { membershipId: viewer.membershipId, capabilityCode: 'content.update' },
    });

    const asOwner = (path: string, init: RequestInit = {}) =>
      fetch(`${owner.baseUrl}${path}`, {
        ...init,
        headers: authHeaders(owner, init.headers as never),
      });
    const asViewer = (path: string, init: RequestInit = {}) =>
      fetch(`${owner.baseUrl}${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          cookie: Object.entries(viewer.cookies)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join('; '),
          'x-csrf-token': viewer.csrf,
        },
      });
    const asOther = (path: string, init: RequestInit = {}) =>
      fetch(`${other.baseUrl}${path}`, { ...init, headers: authHeaders(other) });

    const topicBody = {
      name: 'Launch topic',
      kind: 'TOPIC',
      keywords: ['launch topic'],
      hashtags: ['LaunchTopic'],
      platforms: ['REDDIT'],
      isLive: true,
    };
    const created = await asOwner('/api/v1/listening/rules', {
      method: 'POST',
      body: JSON.stringify(topicBody),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      id: string;
      sync: { status: string };
    };
    expect(createdBody.sync.status === 'QUEUED' || createdBody.sync.status === 'FAILED').toBe(true);

    const second = await asOwner('/api/v1/listening/rules', {
      method: 'POST',
      body: JSON.stringify({
        ...topicBody,
        name: 'Support topic',
        keywords: ['support topic'],
        hashtags: ['SupportTopic'],
      }),
    });
    expect(second.status).toBe(201);
    const secondBody = (await second.json()) as { id: string };

    const invalid = await asOwner('/api/v1/listening/rules', {
      method: 'POST',
      body: JSON.stringify({ ...topicBody, keywords: [], hashtags: [], platforms: [] }),
    });
    expect(invalid.status).toBe(400);

    const denied = await asViewer('/api/v1/listening/rules', {
      method: 'POST',
      body: JSON.stringify(topicBody),
    });
    expect(denied.status).toBe(403);
    const readable = await asViewer('/api/v1/listening/rules');
    expect(readable.status).toBe(200);

    const edited = await asOwner(`/api/v1/listening/rules/${createdBody.id}`, {
      method: 'POST',
      body: JSON.stringify({ keywords: ['launch topic', 'launch alias'] }),
    });
    expect(edited.status).toBe(201);
    const paused = await asOwner(`/api/v1/listening/rules/${createdBody.id}`, {
      method: 'POST',
      body: JSON.stringify({ isLive: false }),
    });
    expect(paused.status).toBe(201);

    const externalPostId = `listen-${newId()}`;
    const prisma = getPrisma();
    await prisma.listeningHit.createMany({
      data: [
        {
          id: newId(),
          tenantId: owner.tenantId,
          ruleId: createdBody.id,
          platform: 'REDDIT',
          externalPostId,
          content: 'launch topic mention',
          matchedKeywordsJson: '["launch topic"]',
        },
        {
          id: newId(),
          tenantId: owner.tenantId,
          ruleId: secondBody.id,
          platform: 'REDDIT',
          externalPostId,
          content: 'support topic mention',
          matchedKeywordsJson: '["support topic"]',
        },
      ],
    });

    const firstHits = await asOwner(`/api/v1/listening/hits?ruleId=${createdBody.id}`);
    const secondHits = await asOwner(`/api/v1/listening/hits?ruleId=${secondBody.id}`);
    expect(firstHits.status).toBe(200);
    expect(secondHits.status).toBe(200);
    const firstItems = ((await firstHits.json()) as { items: Array<{ content: string }> }).items;
    const secondItems = ((await secondHits.json()) as { items: Array<{ content: string }> }).items;
    expect(firstItems.map((item) => item.content)).toEqual(['launch topic mention']);
    expect(secondItems.map((item) => item.content)).toEqual(['support topic mention']);

    const listed = await asOwner('/api/v1/listening/rules');
    const rules = (
      (await listed.json()) as { items: Array<{ id: string; isLive: boolean; keywords: string[] }> }
    ).items;
    const pausedRule = rules.find((rule) => rule.id === createdBody.id);
    expect(pausedRule?.isLive).toBe(false);
    expect(pausedRule?.keywords).toContain('launch alias');
    expect(
      await prisma.listeningHit.count({
        where: { tenantId: owner.tenantId, ruleId: createdBody.id },
      }),
    ).toBe(1);

    const foreign = await asOther('/api/v1/listening/rules');
    const foreignItems = ((await foreign.json()) as { items: Array<{ id: string }> }).items;
    expect(foreignItems.map((rule) => rule.id)).not.toContain(createdBody.id);

    const sources = await asOwner('/api/v1/listening/sources');
    expect(sources.status).toBe(200);
    const sourceBody = (await sources.json()) as {
      sources: Array<{ id: string; readiness: string }>;
      channelsPath: string;
    };
    const youtube = sourceBody.sources.find((source) => source.id === 'YOUTUBE');
    const reddit = sourceBody.sources.find((source) => source.id === 'REDDIT');
    const web = sourceBody.sources.find((source) => source.id === 'WEB');
    expect(youtube?.readiness).toBe('not_configured');
    expect(web?.readiness).toBe('not_configured');
    expect(reddit?.readiness).toBe('public');
    expect(sourceBody.channelsPath.startsWith('/app/brands')).toBe(true);
    expect(JSON.stringify(sourceBody)).not.toMatch(/YOUTUBE_API_KEY|GOOGLE_CSE|apiKey|secret/i);

    if (previousYoutube === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = previousYoutube;
    if (previousCseKey === undefined) delete process.env.GOOGLE_CSE_API_KEY;
    else process.env.GOOGLE_CSE_API_KEY = previousCseKey;
    if (previousCseCx === undefined) delete process.env.GOOGLE_CSE_CX;
    else process.env.GOOGLE_CSE_CX = previousCseCx;
  });
});
