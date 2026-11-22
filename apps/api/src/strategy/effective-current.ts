import { getPrisma } from '@oma/db';
import { effectiveCurrentStrategy } from '@oma/domain';

/**
 * DEC-030: the strategy the brand treats as current (explicit pointer, or the
 * most recently approved ACTIVE strategy for data approved before approve→current).
 * Read-only: never writes the pointer.
 */
export async function resolveEffectiveCurrentStrategy(
  tenantId: string,
  brandId: string,
  pointerId: string | null | undefined,
): Promise<{ id: string | null; inferred: boolean }> {
  const approved = await getPrisma().strategyVersion.findMany({
    where: { tenantId, brandId, status: 'APPROVED' },
    select: { strategyId: true, approvedAt: true, createdAt: true },
  });
  if (approved.length === 0) return { id: null, inferred: false };
  const strategies = await getPrisma().strategy.findMany({
    where: { tenantId, brandId, id: { in: [...new Set(approved.map((v) => v.strategyId))] } },
    select: { id: true, status: true },
  });
  const statusById = new Map(strategies.map((s) => [s.id, s.status as string]));
  return effectiveCurrentStrategy({
    pointerId,
    candidates: approved.map((v) => ({
      id: v.strategyId,
      status: statusById.get(v.strategyId) ?? 'ARCHIVED',
      approvedAt: v.approvedAt ?? v.createdAt,
    })),
  });
}
