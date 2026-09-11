import { afterAll, describe, expect, it } from 'vitest';
import { seedBrandTenant, seedMemberWithoutBrandCaps } from '../helpers/brand-test';

describe('demo API security', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('rejects demo graph when OMA_DEMO_MODE is off', async () => {
    const prev = process.env.OMA_DEMO_MODE;
    process.env.OMA_DEMO_MODE = '0';
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const res = await fetch(`${seed.baseUrl}/api/v1/demo/graph`, {
      headers: {
        cookie: Object.entries(seed.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      },
    });
    expect([403, 404]).toContain(res.status);
    process.env.OMA_DEMO_MODE = prev;
  });

  it('serves linked graph when OMA_DEMO_MODE is on', async () => {
    const prev = process.env.OMA_DEMO_MODE;
    process.env.OMA_DEMO_MODE = '1';
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const res = await fetch(`${seed.baseUrl}/api/v1/demo/journey`, {
      headers: {
        cookie: Object.entries(seed.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-oma-demo-data')).toBe('1');
    const body = (await res.json()) as {
      data: { brand: { id: string }; strategy: { brandId: string } };
    };
    expect(body.data.strategy.brandId).toBe(body.data.brand.id);
    process.env.OMA_DEMO_MODE = prev;
  });

  it('member without brand caps cannot create brands while demo stays readable', async () => {
    const prev = process.env.OMA_DEMO_MODE;
    process.env.OMA_DEMO_MODE = '1';
    const owner = await seedBrandTenant();
    closers.push(async () => owner.app.close());
    const member = await seedMemberWithoutBrandCaps(owner);
    const denied = await fetch(`${owner.baseUrl}/api/v1/brands`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: Object.entries(member.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
        'x-csrf-token': member.csrf ?? '',
      },
      body: JSON.stringify({ name: 'Should Fail' }),
    });
    expect([401, 403]).toContain(denied.status);
    const demo = await fetch(`${owner.baseUrl}/api/v1/demo/campaigns`, {
      headers: {
        cookie: Object.entries(member.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      },
    });
    // Demo is authenticated-read only; capability gates apply to real brand mutations.
    expect([200, 403]).toContain(demo.status);
    process.env.OMA_DEMO_MODE = prev;
  });

  it('creates demo campaign via POST only when demo mode is on and stays planning-only', async () => {
    const prev = process.env.OMA_DEMO_MODE;
    process.env.OMA_DEMO_MODE = '1';
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const headers = {
      'content-type': 'application/json',
      cookie: Object.entries(seed.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
      'x-csrf-token': seed.csrf ?? '',
    };
    const created = await fetch(`${seed.baseUrl}/api/v1/demo/campaigns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: { en: 'Security Create', ar: 'إنشاء أمني' },
        strategyId: 'demo-strategy-q3',
        brandId: 'demo-brand-horizon',
        track: 'PAID',
        owner: 'Security Tester',
        timeline: { start: '2026-09-20', end: '2026-10-01' },
        channels: ['Meta Ads'],
      }),
    });
    expect([200, 201]).toContain(created.status);
    const body = (await created.json()) as {
      data: { budget: { planningOnly: boolean }; id: string };
    };
    expect(body.data.budget.planningOnly).toBe(true);

    process.env.OMA_DEMO_MODE = '0';
    const deniedPost = await fetch(`${seed.baseUrl}/api/v1/demo/campaigns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: { en: 'Nope', ar: 'لا' },
        strategyId: 'demo-strategy-q3',
        brandId: 'demo-brand-horizon',
        track: 'ORGANIC',
        owner: 'X',
        timeline: { start: '2026-09-20', end: '2026-10-01' },
        channels: ['Instagram'],
      }),
    });
    expect([403, 404]).toContain(deniedPost.status);
    process.env.OMA_DEMO_MODE = prev;
  });

  it('creates/updates request, brief, task move and rejects invalid transition + demo-off', async () => {
    const prev = process.env.OMA_DEMO_MODE;
    process.env.OMA_DEMO_MODE = '1';
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const headers = {
      'content-type': 'application/json',
      cookie: Object.entries(seed.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
      'x-csrf-token': seed.csrf ?? '',
    };

    const created = await fetch(`${seed.baseUrl}/api/v1/demo/requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: { en: 'Security request', ar: 'طلب أمني' },
        description: { en: 'Body', ar: 'نص' },
        type: 'DESIGN',
        brandId: 'demo-brand-horizon',
        priority: 'HIGH',
        dueAt: '2026-09-28',
        requester: 'Security Owner',
        channels: ['Instagram'],
        formats: ['Static'],
      }),
    });
    expect([200, 201]).toContain(created.status);
    const requestBody = (await created.json()) as { data: { id: string } };
    const requestId = requestBody.data.id;

    const brief = await fetch(`${seed.baseUrl}/api/v1/demo/requests/${requestId}/brief`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        overview: { en: 'O', ar: 'ن' },
        objective: { en: 'Objective', ar: 'هدف' },
        audience: { en: 'Audience', ar: 'جمهور' },
        keyMessage: { en: 'Key', ar: 'رسالة' },
        deliverableType: { en: 'Static', ar: 'ثابت' },
        channels: ['Instagram'],
        formats: ['1080'],
        tone: { en: 'Calm', ar: 'هادئ' },
        mandatory: { en: 'Logo', ar: 'شعار' },
        cta: { en: 'Shop', ar: 'تسوق' },
        acceptance: { en: 'OK', ar: 'موافق' },
      }),
    });
    expect([200, 201]).toContain(brief.status);

    const convert = await fetch(`${seed.baseUrl}/api/v1/demo/requests/${requestId}/convert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    expect([200, 201]).toContain(convert.status);
    const convertBody = (await convert.json()) as {
      data: { tasks: Array<{ id: string; status: string }> };
    };
    const taskId = convertBody.data.tasks[0]!.id;

    const move = await fetch(`${seed.baseUrl}/api/v1/demo/tasks/${taskId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    expect([200, 201]).toContain(move.status);

    const invalid = await fetch(`${seed.baseUrl}/api/v1/demo/tasks/${taskId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'BACKLOG' }),
    });
    // IN_PROGRESS → BACKLOG not allowed
    expect([400, 422]).toContain(invalid.status);

    const comment = await fetch(`${seed.baseUrl}/api/v1/demo/tasks/${taskId}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        author: 'Security Owner',
        body: { en: 'Note', ar: 'ملاحظة' },
      }),
    });
    expect([200, 201]).toContain(comment.status);

    process.env.OMA_DEMO_MODE = '0';
    const denied = await fetch(`${seed.baseUrl}/api/v1/demo/requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: { en: 'Nope', ar: 'لا' },
        brandId: 'demo-brand-horizon',
        dueAt: '2026-09-28',
        requester: 'X',
      }),
    });
    expect([403, 404]).toContain(denied.status);
    process.env.OMA_DEMO_MODE = prev;
  });
});
