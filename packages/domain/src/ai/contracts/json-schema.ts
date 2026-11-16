import { z } from 'zod';

/**
 * Keywords some strict structured-output providers reject. Zod still enforces
 * every one of them when the output is validated, so dropping them from the
 * provider schema only loosens the hint, never the contract.
 */
export const PROVIDER_UNSUPPORTED_KEYWORDS: ReadonlySet<string> = new Set([
  '$schema',
  'minLength',
  'maxLength',
  'pattern',
  'format',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'default',
]);

function strip(node: unknown, drop: ReadonlySet<string>): unknown {
  if (Array.isArray(node)) return node.map((item) => strip(item, drop));
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'properties' && value && typeof value === 'object') {
      out[key] = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, strip(v, drop)]),
      );
      continue;
    }
    if (drop.has(key)) continue;
    // `const` is not accepted everywhere; a single-value enum means the same thing.
    if (key === 'const') {
      out.enum = [value];
      continue;
    }
    out[key] = strip(value, drop);
  }
  return out;
}

/**
 * JSON Schema handed to a provider's strict structured-output mode, derived
 * from the Zod contract (never written by hand, so the two cannot drift).
 */
export function toProviderJsonSchema(
  schema: z.ZodType,
  drop: ReadonlySet<string> = PROVIDER_UNSUPPORTED_KEYWORDS,
): Record<string, unknown> {
  return strip(z.toJSONSchema(schema, { io: 'input' }), drop) as Record<string, unknown>;
}

export type StrictSchemaIssue = { path: string; problem: string };

/**
 * Check a JSON Schema against the strict structured-output rules shared by the
 * providers: every object is closed and lists all of its properties as required.
 */
export function strictSchemaIssues(node: unknown, path = '$'): StrictSchemaIssue[] {
  const issues: StrictSchemaIssue[] = [];
  if (Array.isArray(node)) {
    node.forEach((item, i) => issues.push(...strictSchemaIssues(item, `${path}[${i}]`)));
    return issues;
  }
  if (!node || typeof node !== 'object') return issues;
  const obj = node as Record<string, unknown>;
  if (obj.type === 'object') {
    const props = (obj.properties ?? {}) as Record<string, unknown>;
    const required = new Set((obj.required as string[] | undefined) ?? []);
    if (obj.additionalProperties !== false) {
      issues.push({ path, problem: 'additionalProperties must be false' });
    }
    for (const key of Object.keys(props)) {
      if (!required.has(key)) issues.push({ path: `${path}.${key}`, problem: 'not required' });
    }
  }
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'properties' && value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        issues.push(...strictSchemaIssues(v, `${path}.${k}`));
      }
    } else if (value && typeof value === 'object') {
      issues.push(...strictSchemaIssues(value, `${path}.${key}`));
    }
  }
  return issues;
}

/** Flatten Zod issues into short, model-readable lines (used by the repair prompt). */
export function describeZodIssues(error: z.ZodError, limit = 20): string[] {
  return error.issues.slice(0, limit).map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
}
