import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { clearBrandContextCache, newId } from '@oma/domain';
import {
  authHeaders,
  createBrand,
  createStrategy,
  seedApprovedProfileVersion,
  seedBrandTenant,
  type BrandSeed,
} from '../helpers/strategy-test';
import { v2Reply } from '../helpers/ai-v2-fixtures';
import { fakeOpenAiEnv, startFakeAiProvider } from '../helpers/fake-ai-provider';

const ENV_KEYS = [
  'AI_PROVIDER',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'AI_LIVE_ENABLED',
  'AI_TEST_ADAPTER',
  'AI_MAX_RETRIES',
  'AI_DEFAULT_MODEL',
  'AI_REASONING_MODEL',
  'AI_REPAIR_ATTEMPTS',
  'STRATEGY_AI_MODE',
];

type Body = {
  data?: {
    run_id: string;
    grounded: boolean;
    used_approved_profile: boolean;
    auto_sent?: boolean;
    language: string;
    variants: Array<{
      text: string;
      factual: boolean;
      generic?: boolean;
      grounding_refs: Array<{ ref: string; kind: string; source_id: string }>;
    }>;
    grounding_refs: Array<{ ref: string; source_id: string }>;
    warnings: string[];
  };
  error?: { code: string; details?: Array<Record<string, unknown>> };
};

async function seedGroundedProfile(tenantId: string, brandId: string) {
  const prisma = getPrisma();
  const profileId = newId();
  await prisma.profileVersion.create({
    data: {
      id: profileId,
      tenantId,
      brandId,
      status: 'APPROVED',
      sectionsJson: JSON.stringify({
        overview: { description: 'Cold-pressed juice bar' },
        banned_words: ['miracle'],
      }),
      approvedAt: new Date(),
      incompletenessAcknowledged: true,
    },
  });
  await prisma.brandWorkspace.update({
    where: { id: brandId },
    data: { currentApprovedProfileVersionId: profileId },
  });
  const claimId = newId();
  await prisma.insightClaim.create({
    data: {
      id: claimId,
      tenantId,
      brandId,
      profileVersionId: profileId,
      fieldKey: 'brand.offer',
      textValue: 'Free delivery on orders over 20 USD',
      reviewStatus: 'ACCEPTED',
      discoveryTier: 'REQUIRED_FOR_APPROVAL',
    },
  });
  await prisma.insightClaim.create({
    data: {
      id: newId(),
      tenantId,
      brandId,
      profileVersionId: profileId,
      fieldKey: 'brand.messaging',
      textValue: 'cures colds',
      reviewStatus: 'REJECTED',
      discoveryTier: 'REQUIRED_FOR_APPROVAL',
    },
  });
  clearBrandContextCache();
  return { profileId, claimId };
}

describe('AI brand grounding (live path, fake provider)', () => {
  let seed: BrandSeed;
  let brandId: string;
  let genericBrandId: string;
  let claimId: string;
  let profileId: string;
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    seed = await seedBrandTenant();
    brandId = (await createBrand(seed)).body.data.id as string;
    genericBrandId = (await createBrand(seed, 'Plain Co')).body.data.id as string;
    ({ claimId, profileId } = await seedGroundedProfile(seed.tenantId, brandId));
  });
  afterAll(async () => {
    await seed.app.close();
  });
  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  async function generate(body: Record<string, unknown>, brand = brandId) {
    const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brand}/ai/captions`, {
      method: 'POST',
      headers: authHeaders(seed, { 'Idempotency-Key': `g-${newId()}` }) as Record<string, string>,
      body: JSON.stringify(body),
    });
    return { res, body: (await res.json()) as Body };
  }

  async function withFake<T>(replies: string[], fn: (requests: unknown[]) => Promise<T>) {
    const fake = await startFakeAiProvider(replies.map((content) => ({ content })));
    try {
      Object.assign(process.env, fakeOpenAiEnv(fake.baseUrl));
      return await fn(fake.requests);
    } finally {
      await fake.close();
    }
  }

  it('rejects an invented ref, repairs, and returns resolved refs', async () => {
    const invented = v2Reply({
      sourceVersion: profileId,
      variants: [
        { text: 'Award-winning juice.', factual: true, groundingRefs: ['C7'] },
        { text: 'Fresh every morning.' },
      ],
    });
    const fixed = v2Reply({
      sourceVersion: profileId,
      variants: [
        { text: 'Free delivery on orders over 20 USD.', factual: true, groundingRefs: ['C1'] },
        { text: 'Fresh every morning.' },
      ],
    });
    await withFake([invented, fixed], async (requests) => {
      const r = await generate({ channel: 'instagram', language: 'en' });
      expect([200, 201]).toContain(r.res.status);
      expect(requests).toHaveLength(2);
      const repair = JSON.stringify((requests[1] as { body: unknown }).body);
      expect(repair).toContain('unknown grounding ref');
      expect(r.body.data).toMatchObject({ grounded: true, used_approved_profile: true });
      expect(r.body.data!.variants[0]!.grounding_refs).toEqual([
        expect.objectContaining({ ref: 'C1', kind: 'claim', source_id: claimId }),
      ]);
      expect(r.body.data!.grounding_refs.map((g) => g.ref)).toEqual(['C1']);
      const run = await getPrisma().aiRun.findUniqueOrThrow({ where: { id: r.body.data!.run_id } });
      expect(run).toMatchObject({
        attemptCount: 2,
        contractId: 'content.variants',
        schemaVersion: '2',
      });
    });
  });

  it('repairs an over-limit caption instead of trimming it', async () => {
    const long = v2Reply({
      sourceVersion: profileId,
      variants: [{ text: 'Juice '.repeat(80).trim() }, { text: 'Fresh every morning.' }],
    });
    const short = v2Reply({
      sourceVersion: profileId,
      variants: [{ text: 'Short and fresh.' }, { text: 'Fresh every morning.' }],
    });
    await withFake([long, short], async (requests) => {
      const r = await generate({ channel: 'x', language: 'en' });
      expect([200, 201]).toContain(r.res.status);
      expect(requests).toHaveLength(2);
      expect(r.body.data!.variants.map((v) => v.text)).toEqual([
        'Short and fresh.',
        'Fresh every morning.',
      ]);
      expect(r.body.data!.warnings.some((w) => w.startsWith('trimmed'))).toBe(false);
    });
  });

  it('rejects output in the wrong language', async () => {
    const english = v2Reply({
      language: 'ar',
      sourceVersion: profileId,
      variants: [
        { text: 'Fresh juice for your morning routine.' },
        { text: 'Cold-pressed and ready for you.' },
      ],
    });
    await withFake([english], async (requests) => {
      const r = await generate({ channel: 'instagram', language: 'ar' });
      expect(r.res.status).toBe(422);
      expect(requests).toHaveLength(2);
      const runs = await getPrisma().aiRun.findMany({
        where: { tenantId: seed.tenantId, status: 'SCHEMA_INVALID' },
      });
      expect(runs.length).toBeGreaterThan(0);
    });
  });

  it('drops banned variants and refuses an inbox reply with only banned claims', async () => {
    const conversationId = newId();
    await getPrisma().inboxConversation.create({
      data: {
        id: conversationId,
        tenantId: seed.tenantId,
        brandId,
        platform: 'META_IG',
        externalThreadId: `ext-${conversationId}`,
        type: 'DIRECT_MESSAGE',
        participantName: 'Sam',
        lastMessagePreview: 'Hello',
      },
    });
    await getPrisma().inboxMessage.create({
      data: {
        id: newId(),
        tenantId: seed.tenantId,
        conversationId,
        senderExternalId: 'sam',
        senderName: 'Sam',
        content: 'Does your juice help when I have a cold?',
        direction: 'INBOUND',
      },
    });
    const banned = v2Reply({
      promptId: 'oma.inbox_reply',
      sourceVersion: profileId,
      variants: [
        { text: 'Yes! Our juice cures colds.' },
        { text: 'It is a miracle drink for colds.' },
      ],
    });
    await withFake([banned], async () => {
      const res = await fetch(
        `${seed.baseUrl}/api/v1/inbox/conversations/${conversationId}/ai/draft`,
        {
          method: 'POST',
          headers: authHeaders(seed, { 'Idempotency-Key': `i-${newId()}` }) as Record<
            string,
            string
          >,
          body: '{}',
        },
      );
      const body = (await res.json()) as Body;
      expect(res.status).toBe(422);
      expect(body.error?.code).toBe('AI_REFUSED');
      expect(body.error?.details?.[0]).toMatchObject({
        code: 'BANNED_CLAIM',
        auto_sent: false,
        dropped: 2,
      });
    });
    const mixed = v2Reply({
      promptId: 'oma.inbox_reply',
      sourceVersion: profileId,
      variants: [
        { text: 'Yes! Our juice cures colds.' },
        { text: 'Thanks for asking! We are happy to help you choose.' },
      ],
    });
    await withFake([mixed], async () => {
      const res = await fetch(
        `${seed.baseUrl}/api/v1/inbox/conversations/${conversationId}/ai/draft`,
        {
          method: 'POST',
          headers: authHeaders(seed, { 'Idempotency-Key': `i-${newId()}` }) as Record<
            string,
            string
          >,
          body: '{}',
        },
      );
      const body = (await res.json()) as Body;
      expect([200, 201]).toContain(res.status);
      expect(body.data!.auto_sent).toBe(false);
      expect(body.data!.language).toBe('en');
      expect(body.data!.variants.map((v) => v.text)).toEqual([
        'Thanks for asking! We are happy to help you choose.',
      ]);
    });
  });

  it('flags generic output when there is no approved profile', async () => {
    process.env.AI_TEST_ADAPTER = '1';
    process.env.AI_LIVE_ENABLED = 'false';
    const r = await generate({ channel: 'instagram', language: 'en' }, genericBrandId);
    expect([200, 201]).toContain(r.res.status);
    expect(r.body.data).toMatchObject({ grounded: false, used_approved_profile: false });
    expect(r.body.data!.variants.every((v) => v.generic === true)).toBe(true);
    expect(r.body.data!.grounding_refs).toEqual([]);
  });

  it('refuses the legacy strategy proposal without an approved profile', async () => {
    process.env.AI_TEST_ADAPTER = '1';
    process.env.AI_LIVE_ENABLED = 'false';
    process.env.STRATEGY_AI_MODE = 'live';
    // Strategies need an approved profile to exist; simulate it being revoked afterwards.
    const lapsedBrandId = (await createBrand(seed, 'Lapsed Co')).body.data.id as string;
    const lapsedProfile = await seedApprovedProfileVersion(seed.tenantId, lapsedBrandId);
    const { body: created } = await createStrategy(seed, lapsedBrandId, {
      organic_enabled: true,
      paid_enabled: false,
    });
    await getPrisma().profileVersion.update({
      where: { id: lapsedProfile },
      data: { status: 'SUPERSEDED' },
    });
    clearBrandContextCache();
    const res = await fetch(
      `${seed.baseUrl}/api/v1/brands/${lapsedBrandId}/strategies/${created.data.id}/versions/${created.data.latest_version.id}/ai/propose`,
      {
        method: 'POST',
        headers: authHeaders(seed, { 'Idempotency-Key': `s-${newId()}` }) as Record<string, string>,
        body: '{}',
      },
    );
    const body = (await res.json()) as Body;
    expect(res.status).toBe(403);
    expect(body.error?.code).toBe('BRAND_PROFILE_NOT_APPROVED');
  });
});
