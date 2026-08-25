export function tenantWhere(
  tenantId: string,
  where: Record<string, unknown> = {},
): { tenantId: string } & Record<string, unknown> {
  return { ...where, tenantId };
}
