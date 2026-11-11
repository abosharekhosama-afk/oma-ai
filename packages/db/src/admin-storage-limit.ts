import { getPrisma } from './prisma.service';

export async function resolveAdminStorageLimitBytes(
  tenantId: string,
  planLimitBytes: number | null,
): Promise<number | null> {
  const row = await getPrisma().workspaceStorageSetting.findUnique({
    where: { tenantId },
    select: { adminStorageLimitBytes: true },
  });
  if (row?.adminStorageLimitBytes != null) {
    const n = Number(row.adminStorageLimitBytes);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return planLimitBytes;
}
