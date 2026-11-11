import { canonicalLimitKey, newId, type PlanLimitKey } from '@oma/domain';
import { getPrisma } from './prisma.service';

export async function resolveTenantLimitOverride(
  tenantId: string,
  key: string,
  planLimit: number | null,
): Promise<number | null> {
  const canonical = canonicalLimitKey(key) as PlanLimitKey;
  const row = await getPrisma().workspaceUsageOverride.findUnique({
    where: { tenantId_key: { tenantId, key: canonical } },
    select: { valueJson: true },
  });
  if (!row) return planLimit;
  try {
    const parsed = JSON.parse(row.valueJson) as number | null;
    if (parsed === null) return null;
    if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0)
      return Math.floor(parsed);
  } catch {
    /* keep plan */
  }
  return planLimit;
}

export async function listTenantUsageOverrides(tenantId: string) {
  const rows = await getPrisma().workspaceUsageOverride.findMany({
    where: { tenantId },
    select: { key: true, valueJson: true },
  });
  return Object.fromEntries(
    rows.map((r) => {
      try {
        return [r.key, JSON.parse(r.valueJson) as number | null];
      } catch {
        return [r.key, null];
      }
    }),
  );
}

export async function upsertTenantUsageOverrides(
  tenantId: string,
  limits: Record<string, number | null | undefined>,
) {
  const prisma = getPrisma();
  for (const [rawKey, rawVal] of Object.entries(limits)) {
    const key = canonicalLimitKey(rawKey);
    if (rawVal === undefined) continue;
    const valueJson = JSON.stringify(
      rawVal === null ? null : Math.max(0, Math.floor(Number(rawVal))),
    );
    await prisma.workspaceUsageOverride.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { id: newId(), tenantId, key, valueJson },
      update: { valueJson, updatedAt: new Date() },
    });
  }
}
