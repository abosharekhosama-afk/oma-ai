import { config as loadDotenv } from 'dotenv';
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';

loadDotenv();

assertE2eDatabaseSafe();

const API = process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001';

export const FIXTURE_WEBSITE_URL = 'https://acme.test/';

/** Tenants created by helpers in this process — cleaned in global teardown. */
export const e2eCreatedTenantIds = new Set<string>();
export const e2eCreatedUserEmails = new Set<string>();

function assertE2eDatabaseSafe() {
  const url = process.env.DATABASE_URL ?? '';
  const allowDev = process.env.OMA_E2E_ALLOW_DEV_DB === '1';
  const isE2eDb = /oma_ai_e2e/i.test(url);
  const looksProd =
    /prod|production|rds\.amazonaws|azure\.com|supabase\.co/i.test(url) &&
    !/127\.0\.0\.1|localhost/.test(url);
  if (looksProd) {
    throw new Error('Refusing to run E2E helpers against a non-local/production DATABASE_URL');
  }
  if (!isE2eDb && !allowDev) {
    throw new Error(
      'E2E requires DATABASE_URL pointing at oma_ai_e2e (or OMA_E2E_ALLOW_DEV_DB=1 for explicit local override)',
    );
  }
}

export function parseCookies(res: APIResponse): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { name, value } of res.headersArray()) {
    if (name.toLowerCase() !== 'set-cookie') continue;
    const [pair] = value.split(';');
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    out[pair.slice(0, eq).trim()] = decodeURIComponent(pair.slice(eq + 1).trim());
  }
  return out;
}

export function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');
}

/**
 * Ephemeral owner: register → self-serve create company (DEC-015) → active tenant.
 * Never uses the bootstrap platform owner, so Development residue cannot accumulate there.
 */
export async function registerBrandOwner(request: APIRequestContext) {
  const email = `e2e-owner-${newId().slice(-10).toLowerCase()}@example.com`;
  const password = 'ChangeMe_E2E_Owner_1!';
  const register = await request.post(`${API}/api/v1/auth/register`, {
    data: { email, password, name: 'E2E Owner' },
  });
  expect(register.ok(), await register.text()).toBeTruthy();
  e2eCreatedUserEmails.add(email);

  const login = await request.post(`${API}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(login.ok(), `login failed: ${login.status()}`).toBeTruthy();
  const cookies = parseCookies(login);

  const tenant = await request.post(`${API}/api/v1/tenants`, {
    headers: {
      cookie: cookieHeader(cookies),
      'x-csrf-token': cookies.oma_csrf,
    },
    data: { name: `E2E Brand Co ${newId().slice(-4)}` },
  });
  expect(tenant.ok(), await tenant.text()).toBeTruthy();
  const tenantBody = await tenant.json();
  e2eCreatedTenantIds.add(tenantBody.tenant.id as string);

  // createTenant already activates; refresh cookies if Set-Cookie present
  Object.assign(cookies, parseCookies(tenant));
  const me = await request.get(`${API}/api/v1/auth/me`, {
    headers: { cookie: cookieHeader(cookies) },
  });
  expect(me.ok()).toBeTruthy();
  const meBody = await me.json();
  if (meBody.active_tenant_id !== tenantBody.tenant.id) {
    const switched = await request.post(`${API}/api/v1/tenants/active`, {
      headers: {
        cookie: cookieHeader(cookies),
        'x-csrf-token': cookies.oma_csrf,
      },
      data: { tenant_id: tenantBody.tenant.id },
    });
    expect(switched.ok(), await switched.text()).toBeTruthy();
    Object.assign(cookies, parseCookies(switched));
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const membership = await prisma.membership.findFirstOrThrow({
    where: { tenantId: tenantBody.tenant.id, userId: user.id, status: 'ACTIVE' },
  });

  return {
    cookies,
    tenantId: tenantBody.tenant.id as string,
    userId: user.id,
    email,
    password,
    membershipId: membership.id,
  };
}

export async function apiPost(
  request: APIRequestContext,
  path: string,
  cookies: Record<string, string>,
  data?: unknown,
  headers?: Record<string, string>,
) {
  return request.post(`${API}${path}`, {
    headers: {
      cookie: cookieHeader(cookies),
      'x-csrf-token': cookies.oma_csrf,
      ...headers,
    },
    data,
  });
}

export async function apiGet(
  request: APIRequestContext,
  path: string,
  cookies: Record<string, string>,
) {
  return request.get(`${API}${path}`, { headers: { cookie: cookieHeader(cookies) } });
}

export async function apiPatch(
  request: APIRequestContext,
  path: string,
  cookies: Record<string, string>,
  data?: unknown,
) {
  return request.patch(`${API}${path}`, {
    headers: {
      cookie: cookieHeader(cookies),
      'x-csrf-token': cookies.oma_csrf,
    },
    data,
  });
}

export async function registerTenantMember(
  request: APIRequestContext,
  owner: { cookies: Record<string, string>; tenantId: string; userId: string },
  capabilityCodes: string[] = ['notification.read'],
) {
  const email = `member-${newId().slice(-8).toLowerCase()}@example.com`;
  const password = 'ChangeMe_Member_1!';
  const register = await request.post(`${API}/api/v1/auth/register`, {
    data: { email, password, name: 'Member' },
  });
  expect(register.ok(), await register.text()).toBeTruthy();
  e2eCreatedUserEmails.add(email);

  const invite = await apiPost(request, '/api/v1/tenants/current/invitations', owner.cookies, {
    email,
  });
  expect(invite.ok(), await invite.text()).toBeTruthy();
  const inviteBody = await invite.json();

  const login = await request.post(`${API}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(login.ok()).toBeTruthy();
  const cookies = parseCookies(login);
  const accepted = await apiPost(request, '/api/v1/invitations/accept', cookies, {
    token: inviteBody.invite_token,
  });
  expect(accepted.ok(), await accepted.text()).toBeTruthy();

  // Elevate capabilities beyond MEMBER default when tests need brand caps.
  if (capabilityCodes.length) {
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const membership = await prisma.membership.findFirstOrThrow({
      where: { tenantId: owner.tenantId, userId: user.id, status: 'ACTIVE' },
    });
    for (const capabilityCode of capabilityCodes) {
      await prisma.capabilityGrant.create({
        data: {
          id: newId(),
          membershipId: membership.id,
          tenantId: owner.tenantId,
          capabilityCode,
          sourceProfileCode: 'CUSTOM',
          grantedBy: owner.userId,
        },
      });
    }
  }

  const switched = await apiPost(request, '/api/v1/tenants/active', cookies, {
    tenant_id: owner.tenantId,
  });
  expect(switched.ok(), await switched.text()).toBeTruthy();
  Object.assign(cookies, parseCookies(switched));
  const prisma = getPrisma();
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const membership = await prisma.membership.findFirstOrThrow({
    where: { tenantId: owner.tenantId, userId: user.id },
  });
  return { cookies, userId: user.id, email, membershipId: membership.id, password };
}

export async function pollScan(
  request: APIRequestContext,
  cookies: Record<string, string>,
  brandId: string,
  scanId: string,
  statuses: string[],
  timeoutMs = 90_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await apiGet(request, `/api/v1/brands/${brandId}/scans/${scanId}`, cookies);
    const body = await res.json();
    if (statuses.includes(body.data?.status)) return body.data;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`scan ${scanId} did not reach ${statuses.join('|')}`);
}

export async function createBrandFlow(request: APIRequestContext, cookies: Record<string, string>) {
  const created = await apiPost(request, '/api/v1/brands', cookies, {
    name: `E2E ${newId().slice(-6)}`,
  });
  expect(created.ok()).toBeTruthy();
  const brand = await created.json();
  const connected = await apiPost(
    request,
    `/api/v1/brands/${brand.data.id}/website`,
    cookies,
    {
      url: FIXTURE_WEBSITE_URL,
      authorization_attested: true,
      version: brand.data.version,
    },
    { 'idempotency-key': newId() },
  );
  expect(connected.ok()).toBeTruthy();
  const scan = await apiPost(
    request,
    `/api/v1/brands/${brand.data.id}/scans`,
    cookies,
    { trigger: 'START' },
    { 'idempotency-key': newId() },
  );
  expect(scan.status()).toBe(202);
  const scanBody = await scan.json();
  const finished = await pollScan(request, cookies, brand.data.id, scanBody.data.scan_attempt_id, [
    'PARTIAL',
    'SUCCEEDED',
    'FAILED',
  ]);
  const scanDetail = await apiGet(
    request,
    `/api/v1/brands/${brand.data.id}/scans/${scanBody.data.scan_attempt_id}`,
    cookies,
  );
  const scanDetailBody = await scanDetail.json();
  return {
    brandId: brand.data.id as string,
    scanId: scanBody.data.scan_attempt_id as string,
    profileVersionId: scanDetailBody.data.profile_version_id as string | null,
    scan: finished,
  };
}

/** Best-effort cleanup of ephemeral E2E tenants created in this run. */
export async function cleanupE2eResidue(tenantIds: Iterable<string> = e2eCreatedTenantIds) {
  const prisma = getPrisma();
  const ids = [...tenantIds];
  if (!ids.length) return { tenants: 0 };
  // Soft-isolation: remove memberships/grants for tracked tenants only (no wildcard).
  const memberships = await prisma.membership.findMany({
    where: { tenantId: { in: ids } },
    select: { id: true },
  });
  const membershipIds = memberships.map((m) => m.id);
  if (membershipIds.length) {
    await prisma.capabilityGrant.deleteMany({ where: { membershipId: { in: membershipIds } } });
    await prisma.invitation.deleteMany({ where: { membershipId: { in: membershipIds } } });
  }
  await prisma.membership.deleteMany({ where: { tenantId: { in: ids } } });
  await prisma.session.updateMany({
    where: { activeTenantId: { in: ids } },
    data: { activeTenantId: null },
  });
  // Leave tenant rows for auditability; they are unusable without memberships.
  return { tenants: ids.length, memberships: membershipIds.length };
}
