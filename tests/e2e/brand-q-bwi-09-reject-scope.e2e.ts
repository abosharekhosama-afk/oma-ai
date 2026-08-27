import { test, expect } from '@playwright/test';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import {
  apiGet,
  apiPost,
  createBrandFlow,
  parseCookies,
  registerBrandOwner,
} from './helpers/brand-api';

const API = process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001';

test.describe('Q-BWI-09 reject scope', () => {
  test('insight decide cannot version reject; insight accept allowed', async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const deciderEmail = `decider-${newId().toLowerCase()}@example.com`;
    const deciderReg = await request.post(`${API}/api/v1/auth/register`, {
      data: {
        email: deciderEmail,
        password: 'ChangeMe_Decider_1!',
        name: 'Decider',
      },
    });
    expect(deciderReg.ok()).toBeTruthy();
    const deciderLogin = await request.post(`${API}/api/v1/auth/login`, {
      data: {
        email: deciderEmail,
        password: 'ChangeMe_Decider_1!',
      },
    });
    expect(deciderLogin.ok()).toBeTruthy();
    const deciderCookies = parseCookies(deciderLogin);
    const prisma = getPrisma();
    const deciderUser = await prisma.user.findUniqueOrThrow({ where: { email: deciderEmail } });
    const membership = await prisma.membership.create({
      data: {
        id: newId(),
        tenantId: owner.tenantId,
        userId: deciderUser.id,
        status: 'ACTIVE',
      },
    });
    await prisma.capabilityGrant.create({
      data: {
        id: newId(),
        membershipId: membership.id,
        tenantId: owner.tenantId,
        capabilityCode: 'brand.insight.decide',
        sourceProfileCode: 'CUSTOM',
        grantedBy: owner.userId,
      },
    });
    await prisma.capabilityGrant.create({
      data: {
        id: newId(),
        membershipId: membership.id,
        tenantId: owner.tenantId,
        capabilityCode: 'brand.read',
        sourceProfileCode: 'CUSTOM',
        grantedBy: owner.userId,
      },
    });
    const switched = await apiPost(request, '/api/v1/tenants/active', deciderCookies, {
      tenant_id: owner.tenantId,
    });
    expect(switched.ok()).toBeTruthy();
    Object.assign(deciderCookies, parseCookies(switched));

    const flow = await createBrandFlow(request, owner.cookies);
    const profile = await apiGet(
      request,
      `/api/v1/brands/${flow.brandId}/profiles/${flow.profileVersionId}`,
      owner.cookies,
    );
    const profileBody = await profile.json();
    const denied = await apiPost(
      request,
      `/api/v1/brands/${flow.brandId}/profiles/${flow.profileVersionId}/reject`,
      deciderCookies,
      { row_version: profileBody.data.row_version },
    );
    expect(denied.status()).toBe(403);

    const insight = profileBody.data.insights[0];
    if (insight) {
      const accept = await apiPost(
        request,
        `/api/v1/brands/${flow.brandId}/insights/${insight.id}/accept`,
        deciderCookies,
        { row_version: insight.row_version },
      );
      expect(accept.ok()).toBeTruthy();
    }
  });
});
