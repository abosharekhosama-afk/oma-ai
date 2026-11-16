import { afterAll, describe, expect, it } from 'vitest';
import { backfillLegacyBriefs, getPrisma } from '@oma/db';
import { newId, type BriefContent } from '@oma/domain';
import { authHeaders, createBrand, seedBrandTenant } from '../helpers/brand-test';

describe('legacy WorkRequest brief backfill (DEC-019 §6)', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  async function setup() {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body } = await createBrand(seed);
    return { seed, brandId: body.data.id as string };
  }

  async function request(
    seed: { tenantId: string; userId: string },
    brandId: string,
    data: Record<string, unknown>,
  ) {
    const row = await getPrisma().workRequest.create({
      data: {
        id: newId(),
        tenantId: seed.tenantId,
        brandId,
        titleEn: 'Launch reel',
        titleAr: 'ريل الإطلاق',
        requesterUserId: seed.userId,
        channels: ['INSTAGRAM'],
        formats: ['REEL'],
        ...data,
      } as never,
    });
    return row.id;
  }

  const fullBrief = {
    briefObjectiveEn: 'Drive pre-orders',
    briefAudienceAr: 'العائلات في الرياض',
    briefKeyMessageEn: 'Launch discount',
  };

  it('dry-runs, then creates DRAFT / IN_REVIEW briefs, skips the rest, and is idempotent', async () => {
    const { seed, brandId } = await setup();
    const prisma = getPrisma();
    const readyAt = new Date('2026-11-01T10:00:00Z');
    const ready = await request(seed, brandId, { ...fullBrief, briefReadyAt: readyAt });
    const draft = await request(seed, brandId, { briefObjectiveEn: 'Only an objective' });
    await request(seed, brandId, {});
    await request(seed, brandId, { ...fullBrief, status: 'CANCELLED' });
    const withTask = await request(seed, brandId, { ...fullBrief, briefReadyAt: readyAt });
    await prisma.workTask.create({
      data: {
        id: newId(),
        tenantId: seed.tenantId,
        brandId,
        requestId: withTask,
        titleEn: 'Existing task',
        titleAr: 'مهمة موجودة',
        createdBy: seed.userId,
      } as never,
    });

    const dry = await backfillLegacyBriefs(prisma, { tenantId: seed.tenantId });
    expect(dry).toMatchObject({
      dryRun: true,
      scanned: 5,
      created: { draft: 1, inReview: 1 },
      skipped: {
        already_backfilled: 0,
        request_closed: 1,
        request_has_tasks: 1,
        no_brief_content: 1,
      },
      createdBriefIds: [],
    });
    expect(await prisma.brief.count({ where: { tenantId: seed.tenantId } })).toBe(0);

    const applied = await backfillLegacyBriefs(prisma, {
      tenantId: seed.tenantId,
      dryRun: false,
      batchSize: 2,
    });
    expect(applied.created).toEqual({ draft: 1, inReview: 1 });
    expect(applied.createdBriefIds).toHaveLength(2);

    const readyBrief = await prisma.brief.findFirstOrThrow({
      where: { tenantId: seed.tenantId, requestId: ready },
      include: { versions: true, decisions: true },
    });
    expect(readyBrief).toMatchObject({
      status: 'IN_REVIEW',
      origin: 'legacy_request',
      brandId,
      createdBy: seed.userId,
      currentVersionNo: 1,
    });
    expect(readyBrief.versions).toHaveLength(1);
    expect(readyBrief.versions[0]!.approvedAt).toBeNull();
    expect(readyBrief.versions[0]!.submittedAt?.toISOString()).toBe(readyAt.toISOString());
    expect(readyBrief.decisions).toEqual([
      expect.objectContaining({ kind: 'SUBMIT', fromStatus: 'DRAFT', toStatus: 'IN_REVIEW' }),
    ]);
    const content = JSON.parse(readyBrief.versions[0]!.contentJson) as BriefContent;
    expect(content).toMatchObject({
      objective_en: 'Drive pre-orders',
      audience_ar: 'العائلات في الرياض',
      channels: ['INSTAGRAM'],
      deliverables: [{ key: 'request-main', title_en: 'Launch reel', format: 'REEL' }],
    });

    const draftBrief = await prisma.brief.findFirstOrThrow({
      where: { tenantId: seed.tenantId, requestId: draft },
      include: { decisions: true },
    });
    expect(draftBrief.status).toBe('DRAFT');
    expect(draftBrief.decisions).toHaveLength(0);

    expect(
      await prisma.auditEvent.count({
        where: { tenantId: seed.tenantId, action: 'brief.legacy_backfilled' },
      }),
    ).toBe(2);
    expect(
      await prisma.brief.count({ where: { status: 'APPROVED', tenantId: seed.tenantId } }),
    ).toBe(0);

    const again = await backfillLegacyBriefs(prisma, { tenantId: seed.tenantId, dryRun: false });
    expect(again.created).toEqual({ draft: 0, inReview: 0 });
    expect(again.skipped.already_backfilled).toBe(2);
    expect(await prisma.brief.count({ where: { tenantId: seed.tenantId } })).toBe(2);
  });

  it('backfilled IN_REVIEW briefs follow the normal review API (approve → convert)', async () => {
    const { seed, brandId } = await setup();
    const prisma = getPrisma();
    const requestId = await request(seed, brandId, {
      ...fullBrief,
      briefReadyAt: new Date(),
    });
    await backfillLegacyBriefs(prisma, { tenantId: seed.tenantId, dryRun: false });
    const brief = await prisma.brief.findFirstOrThrow({
      where: { tenantId: seed.tenantId, requestId },
    });

    const root = `${seed.baseUrl}/api/v1/brands/${brandId}/briefs/${brief.id}`;
    const get = await fetch(root, { headers: { cookie: authHeaders(seed).cookie! } });
    const got = (await get.json()) as {
      data: { status: string; origin: string; row_version: number; allowed_actions: string[] };
    };
    expect(got.data).toMatchObject({ status: 'IN_REVIEW', origin: 'legacy_request' });
    expect(got.data.allowed_actions).toContain('approve');

    const approve = await fetch(`${root}/approve`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ row_version: got.data.row_version }),
    });
    expect([200, 201]).toContain(approve.status);
    const approved = (await approve.json()) as { data: { status: string; row_version: number } };
    expect(approved.data.status).toBe('APPROVED');

    const convert = await fetch(`${root}/convert`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ row_version: approved.data.row_version }),
    });
    expect([200, 201]).toContain(convert.status);
    const tasks = await prisma.workTask.findMany({ where: { briefId: brief.id } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ briefDeliverableKey: 'request-main', brandId });
  });
});
