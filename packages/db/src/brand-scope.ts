import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';

/**
 * Per-request brand access scope.
 *
 * `allowed === null` means unrestricted (workspace owners/admins, the worker, scripts).
 * A string array restricts every brand-owned read to those brands: the Prisma extension in
 * prisma.service.ts adds `brandId IN (allowed)` (or `id IN` for BrandWorkspace, or a relation
 * filter for child rows such as comments) to the where clause, so services cannot leak another
 * brand's rows even if they forget to filter.
 */
export type BrandScope = { allowed: string[] | null };

const storage = new AsyncLocalStorage<BrandScope>();

/** Run `fn` with a mutable scope holder (set `allowed` later, e.g. after authentication). */
export function runWithBrandScope<T>(scope: BrandScope, fn: () => T): T {
  return storage.run(scope, fn);
}

export function currentBrandScope(): BrandScope | undefined {
  return storage.getStore();
}

/** Escape hatch for trusted internal lookups (e.g. resolving access itself). */
export function withoutBrandScope<T>(fn: () => T): T {
  return storage.run({ allowed: null }, fn);
}

type FieldInfo = { brandField: 'brandId' | 'id' | null; nullable: boolean; via?: string };
let modelInfo: Map<string, FieldInfo> | null = null;

function info(): Map<string, FieldInfo> {
  if (modelInfo) return modelInfo;
  const models = Prisma.dmmf.datamodel.models;
  const withBrand = new Set(
    models.filter((m) => m.fields.some((f) => f.name === 'brandId')).map((m) => m.name),
  );
  modelInfo = new Map();
  for (const m of models) {
    if (m.name === 'BrandWorkspace') {
      modelInfo.set(m.name, { brandField: 'id', nullable: false });
      continue;
    }
    const f = m.fields.find((x) => x.name === 'brandId');
    if (f) {
      modelInfo.set(m.name, { brandField: 'brandId', nullable: !f.isRequired });
      continue;
    }
    // Child rows (e.g. ContentComment → content) scoped through a required relation.
    const rel = m.fields.find(
      (x) =>
        x.kind === 'object' &&
        !x.isList &&
        x.isRequired &&
        withBrand.has(x.type) &&
        x.type !== 'BrandWorkspace',
    );
    if (rel) modelInfo.set(m.name, { brandField: null, nullable: false, via: rel.name });
  }
  return modelInfo;
}

const SCOPED_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

/** Where-clause fragment restricting `model` to `allowed` brands, or null if not brand-owned. */
export function brandScopeClause(model: string, allowed: string[]): Record<string, unknown> | null {
  const i = info().get(model);
  if (!i) return null;
  if (i.via) return { [i.via]: { brandId: { in: allowed } } };
  const inAllowed = { [i.brandField!]: { in: allowed } };
  return i.nullable ? { OR: [{ brandId: null }, inAllowed] } : inAllowed;
}

export function scopeArgs(
  model: string | undefined,
  operation: string,
  args: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const scope = storage.getStore();
  if (!model || !scope || scope.allowed === null || !SCOPED_OPS.has(operation)) return args;
  const clause = brandScopeClause(model, scope.allowed);
  if (!clause) return args;
  const a = { ...(args ?? {}) };
  const where = (a.where as Record<string, unknown> | undefined) ?? {};
  const existingAnd = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];
  a.where = { ...where, AND: [...existingAnd, clause] };
  return a;
}
