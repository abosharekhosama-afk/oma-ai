import { test, expect } from '@playwright/test';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import {
  apiGet,
  apiPost,
  createBrandFlow,
  pollScan,
  registerBrandOwner,
} from './helpers/brand-api';

test.describe('Q-BWI-08 late result', () => {
  test('approved version unchanged after rescan', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const flow = await createBrandFlow(request, owner.cookies);
    const profile = await apiGet(
      request,
      `/api/v1/brands/${flow.brandId}/profiles/${flow.profileVersionId}`,
      owner.cookies,
    );
    const profileBody = await profile.json();
    await apiPost(
      request,
      `/api/v1/brands/${flow.brandId}/profiles/${flow.profileVersionId}/approve`,
      owner.cookies,
      {
        row_version: profileBody.data.row_version,
        acknowledge_incomplete: true,
        confirm_summary: true,
      },
    );

    const prisma = getPrisma();
    const before = await prisma.profileVersion.findUniqueOrThrow({
      where: { id: flow.profileVersionId! },
    });

    const rescan = await apiPost(
      request,
      `/api/v1/brands/${flow.brandId}/scans`,
      owner.cookies,
      { config: { max_pages: 1 } },
      { 'idempotency-key': newId() },
    );
    const rescanBody = await rescan.json();
    await pollScan(request, owner.cookies, flow.brandId, rescanBody.data.scan_attempt_id, [
      'PARTIAL',
      'SUCCEEDED',
      'FAILED',
    ]);

    const after = await prisma.profileVersion.findUniqueOrThrow({
      where: { id: flow.profileVersionId! },
    });
    expect(after.status).toBe('APPROVED');
    expect(after.sectionsJson).toBe(before.sectionsJson);
  });
});
