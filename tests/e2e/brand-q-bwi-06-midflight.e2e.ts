import { test, expect } from '@playwright/test';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { apiPost, FIXTURE_WEBSITE_URL, registerBrandOwner } from './helpers/brand-api';

test.describe('Q-BWI-06 midflight suspend', () => {
  test('suspended membership fails scan in worker', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const brand = await apiPost(request, '/api/v1/brands', owner.cookies, { name: 'Mid Brand' });
    const brandBody = await brand.json();
    await apiPost(
      request,
      `/api/v1/brands/${brandBody.data.id}/website`,
      owner.cookies,
      {
        url: FIXTURE_WEBSITE_URL,
        authorization_attested: true,
        version: brandBody.data.version,
      },
      { 'idempotency-key': newId() },
    );
    const scan = await apiPost(
      request,
      `/api/v1/brands/${brandBody.data.id}/scans`,
      owner.cookies,
      {},
      { 'idempotency-key': newId() },
    );
    const scanBody = await scan.json();
    const prisma = getPrisma();
    await prisma.membership.update({
      where: { id: owner.membershipId },
      data: { status: 'SUSPENDED', suspendedAt: new Date() },
    });

    const pollDeadline = Date.now() + 60_000;
    let finishedStatus: string | undefined;
    while (Date.now() < pollDeadline) {
      const attempt = await prisma.scanAttempt.findUnique({
        where: { id: scanBody.data.scan_attempt_id },
      });
      if (attempt && ['FAILED', 'CANCELLED', 'PARTIAL', 'SUCCEEDED'].includes(attempt.status)) {
        finishedStatus = attempt.status;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(finishedStatus, 'scan did not reach terminal status').toBeDefined();
    expect(['FAILED', 'CANCELLED']).toContain(finishedStatus);
  });
});
