import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import {
  authHeaders,
  memberAuthHeaders,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
  type BrandSeed,
} from '../helpers/strategy-test';

type Run = {
  id: string;
  use_case: string;
  status: string;
  attempt_count: number;
  cost_usd: number;
};
type Body = {
  data?: {
    items?: Run[];
    next_cursor?: string | null;
    month?: string;
    totals?: Record<string, number>;
    by_use_case?: Array<Record<string, number | string>>;
  };
  error?: { code: string };
};

async function get(headers: Record<string, string>, url: string) {
  const res = await fetch(url, { headers });
  return { res, body: (await res.json()) as Body };
}

async function seedRun(
  tenantId: string,
  actorUserId: string,
  over: Partial<{
    useCase: string;
    status: 'SUCCEEDED' | 'FAILED' | 'SCHEMA_INVALID' | 'REFUSED';
    attemptCount: number;
    settledCost: string;
    refusalReason: string | null;
    createdAt: Date;
  }> = {},
) {
  return getPrisma().aiRun.create({
    data: {
      id: newId(),
      tenantId,
      actorUserId,
      useCase: over.useCase ?? 'caption_generation',
      provider: 'openai',
      model: 'gpt-test',
      promptVersion: '2',
      schemaVersion: '2',
      sourceEntityType: 'brand',
      sourceEntityId: newId(),
      sourceVersion: 'v1',
      status: over.status ?? 'SUCCEEDED',
      idempotencyKey: `u-${newId()}`,
      inputHash: 'h',
      attemptCount: over.attemptCount ?? 1,
      settledCost: over.settledCost ?? '0.01',
      refusalReason: over.refusalReason ?? null,
      ...(over.createdAt ? { createdAt: over.createdAt } : {}),
    },
  });
}

describe('admin AI usage endpoints (integration)', () => {
  let seed: BrandSeed;
  let other: BrandSeed;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    other = await seedBrandTenant();
    const base = Date.now();
    for (let i = 0; i < 5; i += 1) {
      await seedRun(seed.tenantId, seed.userId, { createdAt: new Date(base - i * 1000) });
    }
    await seedRun(seed.tenantId, seed.userId, {
      status: 'SCHEMA_INVALID',
      attemptCount: 2,
      settledCost: '0.03',
      createdAt: new Date(base - 10_000),
    });
    await seedRun(seed.tenantId, seed.userId, {
      useCase: 'inbox_reply',
      refusalReason: 'HUMAN_REJECTED',
      settledCost: '0.02',
      createdAt: new Date(base - 11_000),
    });
    await seedRun(other.tenantId, other.userId, { useCase: 'other_tenant_case' });
  });
  afterAll(async () => {
    await seed.app.close();
    await other.app.close();
  });

  it('lists only this tenant runs, newest first, with keyset pagination', async () => {
    const headers = authHeaders(seed) as Record<string, string>;
    const first = await get(headers, `${seed.baseUrl}/api/v1/ai/runs?limit=4`);
    expect(first.res.status).toBe(200);
    expect(first.body.data!.items).toHaveLength(4);
    expect(first.body.data!.next_cursor).toBeTruthy();
    const second = await get(
      headers,
      `${seed.baseUrl}/api/v1/ai/runs?limit=4&cursor=${first.body.data!.next_cursor}`,
    );
    const all = [...first.body.data!.items!, ...second.body.data!.items!];
    expect(all).toHaveLength(7);
    expect(new Set(all.map((r) => r.id)).size).toBe(7);
    expect(all.some((r) => r.use_case === 'other_tenant_case')).toBe(false);
    expect(second.body.data!.next_cursor).toBeNull();
    expect(all.at(-1)!.use_case).toBe('inbox_reply');
  });

  it('filters by status and rejects bad filters', async () => {
    const headers = authHeaders(seed) as Record<string, string>;
    const filtered = await get(headers, `${seed.baseUrl}/api/v1/ai/runs?status=SCHEMA_INVALID`);
    expect(filtered.body.data!.items!.map((r) => r.status)).toEqual(['SCHEMA_INVALID']);
    expect(filtered.body.data!.items![0]!.attempt_count).toBe(2);
    const bad = await get(headers, `${seed.baseUrl}/api/v1/ai/runs?status=NOPE`);
    expect(bad.res.status).toBe(400);
    const badCursor = await get(headers, `${seed.baseUrl}/api/v1/ai/runs?cursor=zzz`);
    expect(badCursor.res.status).toBe(400);
  });

  it('summarizes the month per use case from the ledger (real settled cost)', async () => {
    const usage = await get(
      authHeaders(seed) as Record<string, string>,
      `${seed.baseUrl}/api/v1/ai/usage`,
    );
    expect(usage.res.status).toBe(200);
    expect(usage.body.data!.totals).toMatchObject({
      runs: 7,
      failed: 1,
      schema_invalid: 1,
      repaired: 1,
      human_rejected: 1,
    });
    expect(usage.body.data!.totals!.cost_usd).toBeCloseTo(0.1, 6);
    expect(usage.body.data!.by_use_case!.map((b) => b.use_case).sort()).toEqual([
      'caption_generation',
      'inbox_reply',
    ]);
    const empty = await get(
      authHeaders(seed) as Record<string, string>,
      `${seed.baseUrl}/api/v1/ai/usage?month=2001-01`,
    );
    expect(empty.body.data!.totals!.runs).toBe(0);
  });

  it('requires ai.configure (plain members get 403)', async () => {
    const member = await seedMemberWithoutBrandCaps(seed);
    const headers = memberAuthHeaders(member);
    expect((await get(headers, `${seed.baseUrl}/api/v1/ai/runs`)).res.status).toBe(403);
    expect((await get(headers, `${seed.baseUrl}/api/v1/ai/usage`)).res.status).toBe(403);
  });
});
