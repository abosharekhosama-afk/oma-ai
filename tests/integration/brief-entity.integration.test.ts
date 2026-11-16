import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  authHeaders,
  bringToApproved,
  createBrand,
  grantCapability,
  memberAuthHeaders,
  seedBothTracksReadyStrategy,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
  type BrandSeed,
} from '../helpers/strategy-test';

type Brief = {
  id: string;
  status: string;
  row_version: number;
  origin: string;
  allowed_actions: string[];
  readiness: { ready: boolean; missing: string[] };
  current_version: {
    id: string;
    version_no: number;
    approved_at: string | null;
    content: Record<string, unknown> & { deliverables: Array<{ key: string }> };
  };
  versions: Array<{ id: string; version_no: number; approved_at: string | null }>;
  decisions: Array<{ kind: string; self_approval: boolean }>;
  tasks: Array<{ id: string; deliverable_key: string; brief_version_id: string }>;
  replayed?: boolean;
  created_task_count?: number;
};
type Res = { data: Brief; error: { code: string; message_key: string; details: unknown } };

type Headers = Record<string, string>;

const readyContent = {
  objective_en: 'Launch the night cream',
  audience_en: 'Women 25-40 in the Gulf',
  key_message_ar: 'بشرة متجددة كل صباح',
  channels: ['INSTAGRAM'],
  deliverables: [
    { key: 'reel', title_en: 'Launch reel', title_ar: 'ريل الإطلاق', format: 'REEL' },
    { key: 'carousel', title_en: 'Benefits carousel', title_ar: 'كاروسيل الفوائد' },
  ],
};

function api(seed: BrandSeed, brandId: string) {
  const root = `${seed.baseUrl}/api/v1/brands/${brandId}/briefs`;
  const call = async (method: string, path: string, body?: unknown, headers?: Headers) => {
    const h = headers ?? (authHeaders(seed) as Headers);
    const res = await fetch(`${root}${path}`, {
      method,
      headers: method === 'GET' ? { cookie: h.cookie! } : h,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as Res };
  };
  return {
    root,
    create: (body: unknown, h?: Headers) => call('POST', '', body, h),
    get: (id: string, h?: Headers) => call('GET', `/${id}`, undefined, h),
    patch: (id: string, body: unknown, h?: Headers) => call('PATCH', `/${id}`, body, h),
    act: (id: string, action: string, body: unknown, h?: Headers) =>
      call('POST', `/${id}/${action}`, body, h),
    list: (h?: Headers) => call('GET', '', undefined, h),
  };
}

describe('brief entity (DEC-019)', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  async function setup() {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body } = await createBrand(seed);
    const brandId = body.data.id as string;
    return { seed, brandId, b: api(seed, brandId) };
  }

  it('runs DRAFT → IN_REVIEW → CHANGES_REQUESTED → APPROVED → CONVERTED, idempotently', async () => {
    const { b } = await setup();
    const created = await b.create({ title: 'Night cream launch' });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect(created.body.data).toMatchObject({ status: 'DRAFT', origin: 'manual', row_version: 1 });
    expect(created.body.data.readiness.ready).toBe(false);

    const notReady = await b.act(id, 'submit', { row_version: 1 });
    expect(notReady.status).toBe(400);
    expect(notReady.body.error.message_key).toBe('errors.brief_not_ready');

    const badContent = await b.patch(id, { row_version: 1, content: { approved: true } });
    expect(badContent.status).toBe(400);

    const edited = await b.patch(id, { row_version: 1, content: readyContent });
    expect(edited.status).toBe(200);
    expect(edited.body.data.readiness.ready).toBe(true);

    const stale = await b.patch(id, { row_version: 1, title: 'x' });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('CONFLICT_VERSION');

    const convertEarly = await b.act(id, 'convert', { row_version: 2 });
    expect(convertEarly.status).toBe(409);

    const submitted = await b.act(id, 'submit', { row_version: 2 });
    expect([200, 201]).toContain(submitted.status);
    expect(submitted.body.data.status).toBe('IN_REVIEW');

    const frozen = await b.patch(id, { row_version: 3, title: 'Edited in review' });
    expect(frozen.status).toBe(409);
    expect(frozen.body.error.message_key).toBe('errors.brief_invalid_transition');

    const noReason = await b.act(id, 'request-changes', { row_version: 3 });
    expect(noReason.status).toBe(400);
    const changes = await b.act(id, 'request-changes', {
      row_version: 3,
      comment: 'Add an Arabic objective',
    });
    expect(changes.body.data.status).toBe('CHANGES_REQUESTED');

    const fixed = await b.patch(id, {
      row_version: 4,
      content: { ...readyContent, objective_ar: 'إطلاق كريم الليل' },
    });
    expect(fixed.body.data.status).toBe('CHANGES_REQUESTED');
    const resubmitted = await b.act(id, 'submit', { row_version: 5 });
    expect(resubmitted.body.data.status).toBe('IN_REVIEW');

    // Sole approver in the brand: self-approval is allowed and audited.
    const approved = await b.act(id, 'approve', { row_version: 6 });
    expect([200, 201]).toContain(approved.status);
    expect(approved.body.data.status).toBe('APPROVED');
    expect(approved.body.data.current_version.approved_at).toBeTruthy();
    expect(approved.body.data.decisions.at(-1)).toMatchObject({
      kind: 'APPROVE',
      self_approval: true,
    });

    const converted = await b.act(id, 'convert', { row_version: 7 });
    expect([200, 201]).toContain(converted.status);
    expect(converted.body.data).toMatchObject({
      status: 'CONVERTED',
      created_task_count: 2,
      replayed: false,
    });
    expect(converted.body.data.tasks.map((t) => t.deliverable_key).sort()).toEqual([
      'carousel',
      'reel',
    ]);
    const versionId = converted.body.data.current_version.id;
    expect(converted.body.data.tasks.every((t) => t.brief_version_id === versionId)).toBe(true);

    const again = await b.act(id, 'convert', {});
    expect(again.body.data).toMatchObject({ replayed: true, created_task_count: 0 });
    const tasks = await getPrisma().workTask.count({ where: { briefId: id } });
    expect(tasks).toBe(2);

    const revised = await b.act(id, 'revise', { row_version: 8 });
    expect(revised.body.data.status).toBe('DRAFT');
    expect(revised.body.data.current_version.version_no).toBe(2);
    expect(revised.body.data.current_version.approved_at).toBeNull();
    const v1 = revised.body.data.versions.find((v) => v.version_no === 1)!;
    expect(v1.approved_at).toBeTruthy();
    expect(revised.body.data.tasks).toHaveLength(2);

    const audits = await getPrisma().auditEvent.findMany({
      where: { targetId: id, action: { startsWith: 'brief.' } },
      select: { action: true },
    });
    expect(audits.map((a) => a.action)).toEqual(
      expect.arrayContaining(['brief.created', 'brief.submit', 'brief.approve', 'brief.convert']),
    );
  });

  it('blocks self-approval when another approver exists; that approver can approve', async () => {
    const { seed, brandId, b } = await setup();
    const approver = await seedMemberWithoutBrandCaps(seed, {
      brands: [brandId],
      role: 'APPROVER',
    });
    await grantCapability(seed.tenantId, approver.membershipId, 'brief.approve', seed.userId);
    const created = await b.create({ title: 'Needs a second pair of eyes', content: readyContent });
    const id = created.body.data.id;
    await b.act(id, 'submit', { row_version: 1 });

    const self = await b.act(id, 'approve', { row_version: 2 });
    expect(self.status).toBe(403);
    expect(self.body.error.message_key).toBe('errors.brief_self_approval');

    const h = memberAuthHeaders(approver);
    const cannotEdit = await b.patch(id, { row_version: 2, title: 'x' }, h);
    expect(cannotEdit.status).toBe(403);
    const ok = await b.act(id, 'approve', { row_version: 2, comment: 'Looks good' }, h);
    expect([200, 201]).toContain(ok.status);
    expect(ok.body.data.decisions.at(-1)).toMatchObject({ kind: 'APPROVE', self_approval: false });
  });

  it('enforces capabilities: members author but cannot approve or convert', async () => {
    const { seed, brandId, b } = await setup();
    const member = await seedMemberWithoutBrandCaps(seed, { brands: [brandId], role: 'EDITOR' });
    const h = memberAuthHeaders(member);
    const created = await b.create({ title: 'Member brief', content: readyContent }, h);
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const submitted = await b.act(id, 'submit', { row_version: 1 }, h);
    expect([200, 201]).toContain(submitted.status);
    const approve = await b.act(id, 'approve', { row_version: 2 }, h);
    expect(approve.status).toBe(403);
    const owner = await b.act(id, 'approve', { row_version: 2 });
    expect([200, 201]).toContain(owner.status);
    const convert = await b.act(id, 'convert', { row_version: 3 }, h);
    expect(convert.status).toBe(403);
    const comment = await b.act(id, 'comments', { body: 'Thanks!' }, h);
    expect([200, 201]).toContain(comment.status);
  });

  it('prefills from an APPROVED strategy only, as a DRAFT', async () => {
    const { seed, brandId, b } = await setup();
    const ready = await seedBothTracksReadyStrategy(seed, brandId);
    const planUrl = `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${ready.strategyId}/versions/${ready.versionId}/plan`;
    const organic = await fetch(`${planUrl}/organic`, {
      method: 'PUT',
      headers: authHeaders(seed),
      body: JSON.stringify({
        row_version: ready.rowVersion,
        pillars: [{ key: 'education', name_en: 'Education', name_ar: 'التثقيف' }],
      }),
    });
    const organicBody = (await organic.json()) as { data: { row_version: number } };

    const early = await fetch(`${b.root}/from-strategy`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ strategy_version_id: ready.versionId }),
    });
    expect(early.status).toBe(409);

    await bringToApproved(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      organicBody.data.row_version,
    );
    const res = await fetch(`${b.root}/from-strategy`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ strategy_version_id: ready.versionId, pillar_key: 'education' }),
    });
    const body = (await res.json()) as Res;
    expect(res.status).toBe(201);
    expect(body.data).toMatchObject({ status: 'DRAFT', origin: 'strategy' });
    expect(body.data.current_version.content.objective_en).toContain('Grow reach');
    expect(body.data.current_version.content.deliverables[0]!.key).toBe('education-content');

    const unknown = await fetch(`${b.root}/from-strategy`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ strategy_version_id: ready.versionId, pillar_key: 'nope' }),
    });
    expect(unknown.status).toBe(400);
  });

  it('links at most one brief per request and hides other tenants’ briefs', async () => {
    const { seed, brandId, b } = await setup();
    const request = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/requests`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ title_en: 'Launch', title_ar: 'إطلاق' }),
    });
    const requestBody = (await request.json()) as { data: { id: string } };
    expect([200, 201]).toContain(request.status);
    const first = await b.create({ title: 'From request', request_id: requestBody.data.id });
    expect(first.status).toBe(201);
    const second = await b.create({ title: 'Again', request_id: requestBody.data.id });
    expect(second.status).toBe(409);
    expect(second.body.error.message_key).toBe('errors.brief_request_taken');

    const other = await setup();
    const foreign = await other.b.get(first.body.data.id);
    expect(foreign.status).toBe(404);
    const foreignBrand = await api(other.seed, brandId).get(first.body.data.id);
    expect(foreignBrand.status).toBe(404);
    const list = await other.b.list();
    expect(list.body.data).toEqual([]);
  });
});
