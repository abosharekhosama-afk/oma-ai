import { config as loadDotenv } from 'dotenv';
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';

loadDotenv();

const API = process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001';

export const FIXTURE_WEBSITE_URL = 'https://acme.test/';

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

export async function registerBrandOwner(request: APIRequestContext) {
  const ownerEmail = process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL ?? 'platform-owner@example.com';
  const ownerPassword =
    process.env.BOOTSTRAP_PLATFORM_OWNER_PASSWORD ?? 'ChangeMe_PlatformOwner_1!';
  const login = await request.post(`${API}/api/v1/auth/login`, {
    data: { email: ownerEmail, password: ownerPassword },
  });
  expect(login.ok(), `platform login failed: ${login.status()}`).toBeTruthy();
  const cookies = parseCookies(login);
  const slug = `e2e-brand-${newId().toLowerCase().slice(-8)}`;
  const tenant = await request.post(`${API}/api/v1/tenants`, {
    headers: {
      cookie: cookieHeader(cookies),
      'x-csrf-token': cookies.oma_csrf,
    },
    data: { name: 'E2E Brand Co', slug },
  });
  expect(tenant.ok(), await tenant.text()).toBeTruthy();
  const tenantBody = await tenant.json();
  const switched = await request.post(`${API}/api/v1/tenants/active`, {
    headers: {
      cookie: cookieHeader(cookies),
      'x-csrf-token': cookies.oma_csrf,
    },
    data: { tenant_id: tenantBody.tenant.id },
  });
  expect(switched.ok(), await switched.text()).toBeTruthy();
  Object.assign(cookies, parseCookies(switched));

  const prisma = getPrisma();
  const user = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });
  const membership = await prisma.membership.findFirstOrThrow({
    where: { tenantId: tenantBody.tenant.id, userId: user.id },
  });

  return {
    cookies,
    tenantId: tenantBody.tenant.id as string,
    userId: user.id,
    email: ownerEmail,
    password: ownerPassword,
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
  ownerTenantId: string,
  grantedByUserId: string,
  capabilityCodes: string[] = ['notification.read'],
) {
  const email = `member-${newId().slice(-8).toLowerCase()}@example.com`;
  const password = 'ChangeMe_Member_1!';
  const register = await request.post(`${API}/api/v1/auth/register`, {
    data: { email, password, name: 'Member' },
  });
  expect(register.ok(), await register.text()).toBeTruthy();
  const login = await request.post(`${API}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(login.ok()).toBeTruthy();
  const cookies = parseCookies(login);
  const prisma = getPrisma();
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const membership = await prisma.membership.create({
    data: {
      id: newId(),
      tenantId: ownerTenantId,
      userId: user.id,
      status: 'ACTIVE',
    },
  });
  for (const capabilityCode of capabilityCodes) {
    await prisma.capabilityGrant.create({
      data: {
        id: newId(),
        membershipId: membership.id,
        tenantId: ownerTenantId,
        capabilityCode,
        sourceProfileCode: 'CUSTOM',
        grantedBy: grantedByUserId,
      },
    });
  }
  const switched = await apiPost(request, '/api/v1/tenants/active', cookies, {
    tenant_id: ownerTenantId,
  });
  expect(switched.ok(), await switched.text()).toBeTruthy();
  Object.assign(cookies, parseCookies(switched));
  return { cookies, userId: user.id, email, membershipId: membership.id };
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
