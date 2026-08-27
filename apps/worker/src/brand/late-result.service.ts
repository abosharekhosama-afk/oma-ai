import { getPrisma } from '@oma/db';
import { shouldCreateLateDraft } from '@oma/domain';
import { createProfileDraftFromScan } from './profile-draft.service';

export async function handleLateScanResult(input: {
  tenantId: string;
  brandId: string;
  scanAttemptId: string;
  coverageSnapshot: Record<string, unknown>;
}) {
  const brand = await getPrisma().brandWorkspace.findFirst({
    where: { id: input.brandId, tenantId: input.tenantId },
  });
  if (!brand) return { action: 'ignored' as const };

  if (!shouldCreateLateDraft(brand.currentApprovedProfileVersionId)) {
    return { action: 'ignored' as const };
  }

  const approved = await getPrisma().profileVersion.findFirst({
    where: { id: brand.currentApprovedProfileVersionId!, status: 'APPROVED' },
  });
  if (!approved) {
    return { action: 'ignored' as const };
  }

  const versionId = await createProfileDraftFromScan({
    tenantId: input.tenantId,
    brandId: input.brandId,
    scanAttemptId: input.scanAttemptId,
    aiAvailability: 'NOT_CONFIGURED',
    coverageSnapshot: input.coverageSnapshot,
  });

  return { action: 'late_draft_created' as const, profileVersionId: versionId };
}
