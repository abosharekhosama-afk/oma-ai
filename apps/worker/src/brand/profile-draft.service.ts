import { getPrisma } from '@oma/db';
import { discoveryTierForField, isRequiredForApproval, newId } from '@oma/domain';

export async function createProfileDraftFromScan(input: {
  tenantId: string;
  brandId: string;
  scanAttemptId: string;
  aiAvailability: 'NOT_CONFIGURED' | 'UNAVAILABLE' | 'USED' | 'SKIPPED';
  coverageSnapshot: Record<string, unknown>;
}) {
  const observations = await getPrisma().extractedObservation.findMany({
    where: { tenantId: input.tenantId, scanAttemptId: input.scanAttemptId },
  });

  const versionId = newId();
  const sections = {
    overview: {},
    catalog: {},
    languages: {},
    claims: {},
    risks: {},
    evidence_refs: observations.map((o) => o.evidenceId).filter(Boolean),
  };

  await getPrisma().profileVersion.create({
    data: {
      id: versionId,
      tenantId: input.tenantId,
      brandId: input.brandId,
      scanAttemptId: input.scanAttemptId,
      status: 'NEEDS_REVIEW',
      aiAvailability: input.aiAvailability,
      coverageSnapshotJson: JSON.stringify(input.coverageSnapshot),
      sectionsJson: JSON.stringify(sections),
    },
  });

  for (const obs of observations) {
    const value = obs.valueJson ? JSON.parse(obs.valueJson) : null;
    const insightId = newId();
    await getPrisma().insightClaim.create({
      data: {
        id: insightId,
        tenantId: input.tenantId,
        brandId: input.brandId,
        profileVersionId: versionId,
        fieldKey: obs.fieldKey,
        infoState: obs.infoState,
        reviewStatus: isRequiredForApproval(obs.fieldKey) ? 'PENDING' : 'PENDING',
        textValue: typeof value === 'string' ? value : value ? JSON.stringify(value) : null,
        valueJson: obs.valueJson,
        evidenceId: obs.evidenceId,
        discoveryTier: discoveryTierForField(obs.fieldKey) as never,
        createdBy: 'SYSTEM',
      },
    });
    await getPrisma().extractedObservation.update({
      where: { id: obs.id },
      data: { profileVersionId: versionId },
    });
  }

  return versionId;
}
