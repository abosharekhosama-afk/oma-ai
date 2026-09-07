#!/usr/bin/env node
/**
 * Validates reference artifacts. A successful inspection cannot be an empty
 * JSON file, and AUTH_REQUIRED / BROWSER_UNAVAILABLE / BLOCKED outcomes are
 * never accepted as successful reference capture.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { REFERENCE_ROOT, REPO_ROOT, parseArgs, readJson } from './lib/config.mjs';
import { EXIT, printCompact } from './lib/compact.mjs';

const SCHEMAS = readJson(join(REFERENCE_ROOT, '_schema/schemas.json'));
const NON_CAPTURE_OUTCOMES = new Set(['AUTH_REQUIRED', 'BROWSER_UNAVAILABLE', 'BLOCKED']);

function artifactKind(path) {
  return basename(path).replace(/\.json$/, '');
}

export function validateArtifact(path) {
  const errors = [];
  const kind = artifactKind(path);
  const schema = SCHEMAS.artifacts[kind];
  if (!schema) {
    return { path, kind, valid: false, errors: [`no schema for artifact kind "${kind}"`] };
  }

  let doc;
  try {
    doc = readJson(path);
  } catch (err) {
    return { path, kind, valid: false, errors: [`invalid JSON: ${err.message}`] };
  }

  for (const key of schema.required ?? []) {
    if (doc[key] === undefined) errors.push(`missing top-level "${key}"`);
  }
  for (const key of schema.meta?.required ?? []) {
    if (doc.meta?.[key] === undefined) errors.push(`missing meta.${key}`);
  }

  const outcome = doc.meta?.outcome;
  if (outcome !== undefined && !SCHEMAS.vocabularies.captureOutcome.includes(outcome)) {
    errors.push(`meta.outcome "${outcome}" is not a known capture outcome`);
  }
  if (NON_CAPTURE_OUTCOMES.has(outcome)) {
    errors.push(
      `meta.outcome "${outcome}" is not a successful capture and cannot be used as evidence`,
    );
  }
  if (
    doc.meta?.inspectionMode !== undefined &&
    !SCHEMAS.vocabularies.inspectionMode.includes(doc.meta.inspectionMode)
  ) {
    errors.push(`meta.inspectionMode "${doc.meta.inspectionMode}" is not a known mode`);
  }

  for (const key of schema.nonEmptyArray ?? []) {
    if (!Array.isArray(doc[key]) || doc[key].length === 0) {
      errors.push(`"${key}" must contain at least one entry`);
    }
  }

  for (const [key, rules] of Object.entries(schema.itemRules ?? {})) {
    const items = doc[key];
    if (!Array.isArray(items)) continue;
    items.forEach((item, index) => {
      for (const field of rules.required ?? []) {
        if (item[field] === undefined) errors.push(`${key}[${index}] missing "${field}"`);
      }
      for (const [field, vocabulary] of Object.entries(rules.enum ?? {})) {
        const allowed = SCHEMAS.vocabularies[vocabulary];
        if (item[field] !== undefined && !allowed.includes(item[field])) {
          errors.push(`${key}[${index}].${field} "${item[field]}" is not in ${vocabulary}`);
        }
      }
    });
  }

  return { path, kind, valid: errors.length === 0, errors };
}

function collect(target) {
  if (!existsSync(target)) return [];
  if (statSync(target).isFile()) return [target];
  return readdirSync(target)
    .filter((f) => f.endsWith('.json') && f !== 'reference-config.json')
    .map((f) => join(target, f))
    .filter((f) => SCHEMAS.artifacts[artifactKind(f)]);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = args.path
    ? join(REPO_ROOT, args.path)
    : args.reference
      ? join(REFERENCE_ROOT, args.reference)
      : null;

  if (!target) {
    printCompact({
      STATUS: 'BLOCKED',
      MODE: 'ARTIFACT_VALIDATION',
      REASON: 'pass --reference <id> or --path <file-or-dir>',
    });
    return EXIT.USAGE;
  }

  const files = collect(target);
  if (files.length === 0) {
    printCompact({
      STATUS: 'BLOCKED',
      MODE: 'ARTIFACT_VALIDATION',
      REASON: `no known artifacts found at ${args.path ?? args.reference}`,
    });
    return EXIT.BLOCKED;
  }

  const results = files.map(validateArtifact);
  const invalid = results.filter((r) => !r.valid);
  for (const result of invalid) {
    process.stderr.write(`${result.path}\n`);
    for (const error of result.errors) process.stderr.write(`  - ${error}\n`);
  }

  printCompact({
    STATUS: invalid.length ? 'BLOCKED' : 'SUCCESS',
    MODE: 'ARTIFACT_VALIDATION',
    REASON: `${results.length - invalid.length}/${results.length} artifact(s) valid`,
    BLOCKERS: invalid.length ? invalid.map((r) => artifactKind(r.path)).join(', ') : 'NONE',
  });
  return invalid.length ? EXIT.BLOCKED : EXIT.SUCCESS;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
