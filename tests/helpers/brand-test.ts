import { getPrisma } from '@oma/db';
import { newId, SYSTEM_PROFILES } from '@oma/domain';
import IORedis from 'ioredis';
import { Queue, QueueEvents } from 'bullmq';
import { publishPendingOutbox } from '../../apps/worker/src/processors/outbox.publisher';
import { startIngestionProcessor } from '../../apps/worker/src/processors/ingestion.processor';
import { bullIngestionJobId } from '../../apps/worker/src/processors/ingestion-job-payload';
import { createTestApp, cookieHeader, parseCookies } from './app';

/** Public HTTPS URL mapped to acme fixture (passes SSRF policy). */
export const FIXTURE_WEBSITE_URL = 'https://acme.test/';

process.env.BRAND_FIXTURE_CONNECTOR = process.env.BRAND_FIXTURE_CONNECTOR ?? '1';

export type BrandSeed = Awaited<ReturnType<typeof seedBrandTenant>>;

export function authHeaders(seed: BrandSeed, extra?: Record<string, string>) {
  return {
    'content-type': 'application/json',
    cookie: cookieHeader(seed.cookies),
    'x-csrf-token': seed.csrf,
    ...extra,
  };
}

export async function seedBrandTenant(input?: {
  email?: string;
  password?: string;
  tenantSlug?: string;
}) {
  const slug = input?.tenantSlug ?? `brand-${newId().slice(-8).toLowerCase()}`;
  const ownerEmail = process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL ?? 'platform-owner@example.com';
  const ownerPassword =
    process.env.BOOTSTRAP_PLATFORM_OWNER_PASSWORD ?? 'ChangeMe_PlatformOwner_1!';

  const { app, baseUrl } = await createTestApp();
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
  });
  const cookies = parseCookies(login);
  const csrf = cookies[process.env.CSRF_COOKIE_NAME ?? 'oma_csrf'];

  const tenantRes = await fetch(`${baseUrl}/api/v1/tenants`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: cookieHeader(cookies),
      'x-csrf-token': csrf,
    },
    body: JSON.stringify({ name: 'Brand Tenant', slug }),
  });
  if (!tenantRes.ok) {
    throw new Error(`tenant create failed: ${tenantRes.status} ${await tenantRes.text()}`);
  }
  const tenantBody = (await tenantRes.json()) as { tenant: { id: string } };

  const switched = await fetch(`${baseUrl}/api/v1/tenants/active`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: cookieHeader(cookies),
      'x-csrf-token': csrf,
    },
    body: JSON.stringify({ tenant_id: tenantBody.tenant.id }),
  });
  if (!switched.ok) {
    throw new Error(`tenant activate failed: ${switched.status} ${await switched.text()}`);
  }
  Object.assign(cookies, parseCookies(switched));

  const prisma = getPrisma();
  const user = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });
  const membership = await prisma.membership.findFirstOrThrow({
    where: { tenantId: tenantBody.tenant.id, userId: user.id },
  });

  return {
    app,
    baseUrl,
    cookies,
    csrf,
    tenantId: tenantBody.tenant.id,
    userId: user.id,
    email: ownerEmail,
    password: ownerPassword,
    membershipId: membership.id,
  };
}

export async function seedMemberWithoutBrandCaps(ownerSeed: BrandSeed) {
  const email = `member-${newId().slice(-8)}@example.com`;
  const password = 'ChangeMe_Member_1!';
  const register = await fetch(`${ownerSeed.baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Member' }),
  });
  if (!register.ok) {
    throw new Error(`member register failed: ${register.status} ${await register.text()}`);
  }
  const regBody = (await register.json()) as { user: { id: string; email: string } };
  const login = await fetch(`${ownerSeed.baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) {
    throw new Error(`member login failed: ${login.status} ${await login.text()}`);
  }
  const memberCookies = parseCookies(login);
  const memberCsrf = memberCookies[process.env.CSRF_COOKIE_NAME ?? 'oma_csrf'];
  const prisma = getPrisma();
  const memberUser = await prisma.user.findUniqueOrThrow({
    where: { id: regBody.user.id },
  });
  const membership = await prisma.membership.create({
    data: {
      id: newId(),
      tenantId: ownerSeed.tenantId,
      userId: memberUser.id,
      status: 'ACTIVE',
    },
  });
  for (const code of SYSTEM_PROFILES.MEMBER ?? []) {
    await prisma.capabilityGrant.create({
      data: {
        id: newId(),
        membershipId: membership.id,
        tenantId: ownerSeed.tenantId,
        capabilityCode: code,
        sourceProfileCode: 'MEMBER',
        grantedBy: ownerSeed.userId,
      },
    });
  }
  const switched = await fetch(`${ownerSeed.baseUrl}/api/v1/tenants/active`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: cookieHeader(memberCookies),
      'x-csrf-token': memberCsrf,
    },
    body: JSON.stringify({ tenant_id: ownerSeed.tenantId }),
  });
  if (!switched.ok) {
    throw new Error(`member tenant switch failed: ${switched.status} ${await switched.text()}`);
  }
  Object.assign(memberCookies, parseCookies(switched));
  const activeCsrf = memberCookies[process.env.CSRF_COOKIE_NAME ?? 'oma_csrf'];
  return {
    email,
    password,
    cookies: memberCookies,
    csrf: activeCsrf,
    userId: memberUser.id,
    membershipId: membership.id,
  };
}

export async function grantCapability(
  tenantId: string,
  membershipId: string,
  capabilityCode: string,
  grantedBy: string,
) {
  const prisma = getPrisma();
  await prisma.capabilityGrant.create({
    data: {
      id: newId(),
      membershipId,
      tenantId,
      capabilityCode,
      sourceProfileCode: 'CUSTOM',
      grantedBy,
    },
  });
}

export async function createBrand(seed: BrandSeed, name?: string) {
  const res = await fetch(`${seed.baseUrl}/api/v1/brands`, {
    method: 'POST',
    headers: authHeaders(seed),
    body: JSON.stringify({ name: name ?? `Brand ${newId().slice(-6)}` }),
  });
  const body = await res.json();
  return { res, body };
}

export async function connectWebsite(
  seed: BrandSeed,
  brandId: string,
  url: string,
  version: number,
  attested = true,
) {
  const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/website`, {
    method: 'POST',
    headers: authHeaders(seed, { 'idempotency-key': newId() }),
    body: JSON.stringify({ url, authorization_attested: attested, version }),
  });
  return { res, body: await res.json() };
}

export async function startScan(
  seed: BrandSeed,
  brandId: string,
  idempotencyKey?: string,
  config?: { max_pages?: number; max_depth?: number; max_duration_seconds?: number },
  trigger?: string,
) {
  const key = idempotencyKey ?? newId();
  const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/scans`, {
    method: 'POST',
    headers: authHeaders(seed, { 'idempotency-key': key }),
    body: JSON.stringify({ trigger, config }),
  });
  const body = await res.json();
  return { res, body, idempotencyKey: key };
}

export async function cancelScan(seed: BrandSeed, brandId: string, scanId: string) {
  const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/scans/${scanId}/cancel`, {
    method: 'POST',
    headers: authHeaders(seed),
    body: '{}',
  });
  return { res, body: await res.json() };
}

export async function retryScan(
  seed: BrandSeed,
  brandId: string,
  scanId: string,
  idempotencyKey?: string,
) {
  const key = idempotencyKey ?? newId();
  const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/scans/${scanId}/retry`, {
    method: 'POST',
    headers: authHeaders(seed, { 'idempotency-key': key }),
    body: '{}',
  });
  return { res, body: await res.json(), idempotencyKey: key };
}

export async function getScan(seed: BrandSeed, brandId: string, scanId: string) {
  const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/scans/${scanId}`, {
    headers: { cookie: cookieHeader(seed.cookies) },
  });
  return { res, body: await res.json() };
}

export async function getProfile(seed: BrandSeed, brandId: string, versionId: string) {
  const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/profiles/${versionId}`, {
    headers: { cookie: cookieHeader(seed.cookies) },
  });
  return { res, body: await res.json() };
}

export async function approveProfile(
  seed: BrandSeed,
  brandId: string,
  versionId: string,
  rowVersion: number,
  opts?: { acknowledge_incomplete?: boolean; confirm_summary?: boolean },
) {
  const res = await fetch(
    `${seed.baseUrl}/api/v1/brands/${brandId}/profiles/${versionId}/approve`,
    {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({
        row_version: rowVersion,
        acknowledge_incomplete: opts?.acknowledge_incomplete ?? true,
        confirm_summary: opts?.confirm_summary ?? true,
      }),
    },
  );
  return { res, body: await res.json() };
}

export async function rejectProfileVersion(
  seed: BrandSeed,
  brandId: string,
  versionId: string,
  rowVersion: number,
) {
  const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/profiles/${versionId}/reject`, {
    method: 'POST',
    headers: authHeaders(seed),
    body: JSON.stringify({ row_version: rowVersion }),
  });
  return { res, body: await res.json() };
}

export async function pollScanUntil(
  seed: BrandSeed,
  brandId: string,
  scanId: string,
  statuses: string[],
  timeoutMs = 60_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { body } = await getScan(seed, brandId, scanId);
    if (statuses.includes(body.data?.status)) return body.data;
    await new Promise((r) => setTimeout(r, 250));
  }
  const { body } = await getScan(seed, brandId, scanId);
  throw new Error(`scan ${scanId} stuck at ${body.data?.status}; wanted ${statuses.join('|')}`);
}

export async function runIngestionForJobRun(
  connection: IORedis,
  jobRunId: string,
  options?: Parameters<typeof startIngestionProcessor>[1],
) {
  const events = new QueueEvents('ingestion', { connection });
  await events.waitUntilReady();
  const queue = new Queue('ingestion', { connection });
  const worker = startIngestionProcessor(connection, options);
  try {
    await publishPendingOutbox(connection);
    const job = await queue.getJob(bullIngestionJobId(jobRunId));
    if (job) {
      await job.waitUntilFinished(events, 90_000);
    }
  } finally {
    await worker.close();
    await events.close();
    await queue.close();
    await new Promise((r) => setTimeout(r, 100));
  }
}

export async function fullScanJourney(
  seed: BrandSeed,
  connection: IORedis,
  config?: { max_pages?: number; max_depth?: number },
) {
  const { body: brandBody } = await createBrand(seed);
  const brandId = brandBody.data.id;
  const brandVersion = brandBody.data.version;
  await connectWebsite(seed, brandId, FIXTURE_WEBSITE_URL, brandVersion);
  const { body: scanBody } = await startScan(seed, brandId, newId(), config);
  const scanId = scanBody.data.scan_attempt_id;
  const jobRunId = scanBody.data.job_run_id;
  await runIngestionForJobRun(connection, jobRunId);
  const scan = await pollScanUntil(seed, brandId, scanId, ['PARTIAL', 'SUCCEEDED', 'FAILED']);
  const profileVersionId = (await getScan(seed, brandId, scanId)).body.data.profile_version_id as
    string | null;
  return { brandId, scanId, jobRunId, scan, profileVersionId };
}

export function createRedisConnection() {
  return new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
  });
}
