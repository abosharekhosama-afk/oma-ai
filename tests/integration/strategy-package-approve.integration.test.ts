import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  approveStrategy,
  createBrand,
  seedBothTracksReadyStrategy,
  seedBrandTenant,
  seedReviewReadyStrategy,
  submitStrategy,
} from '../helpers/strategy-test';

describe('strategy package approve', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('creates one StrategyApprovalRecord; disabled track rationale persisted; current stays null', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    const submitted = await submitStrategy(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      ready.rowVersion,
    );
    const approved = await approveStrategy(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      submitted.body.data.row_version,
    );
    expect([200, 201]).toContain(approved.res.status);
    expect(approved.body.data.status).toBe('APPROVED');
    expect(approved.body.data.paid_enabled).toBe(false);
    expect(approved.body.data.paid_disabled_rationale).toMatch(/Paid deferred/i);

    const records = await getPrisma().strategyApprovalRecord.findMany({
      where: { strategyVersionId: ready.versionId },
    });
    expect(records).toHaveLength(1);
    expect(records[0]!.organicEnabled).toBe(true);
    expect(records[0]!.paidEnabled).toBe(false);

    const brandRow = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(brandRow.currentApprovedStrategyId).toBeNull();
  });

  it('approves both enabled tracks as one package with current still null', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedBothTracksReadyStrategy(seed, brandId);
    const submitted = await submitStrategy(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      ready.rowVersion,
    );
    const approved = await approveStrategy(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      submitted.body.data.row_version,
    );
    expect([200, 201]).toContain(approved.res.status);
    const record = await getPrisma().strategyApprovalRecord.findUniqueOrThrow({
      where: { strategyVersionId: ready.versionId },
    });
    expect(record.organicEnabled).toBe(true);
    expect(record.paidEnabled).toBe(true);
    const brandRow = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(brandRow.currentApprovedStrategyId).toBeNull();
  });
});
