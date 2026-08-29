#!/usr/bin/env node
/**
 * Reference inspection orchestrator. It sequences preflight, worker dispatch,
 * bounded retries, and artifact validation, and returns compact output while
 * detail goes to JSONL on disk.
 *
 * Product-neutral by design: the reference, target, and mode are arguments, so
 * the command is never tied to one external product.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, ensureDir, findReference, loadConfig, parseArgs } from './lib/config.mjs';
import { EXIT, createLogger, printCompact } from './lib/compact.mjs';
import { validateArtifact } from './validate-reference-artifacts.mjs';
import { snapshotSource, verifySource } from './lib/source-integrity.mjs';

const run = promisify(execFile);

const MODES = new Set([
  'PAGE_INSPECTION',
  'JOURNEY_INSPECTION',
  'MODULE_INSPECTION',
  'NAVIGATION_DISCOVERY',
  'ROLE_INSPECTION',
  'PARITY_AUDIT',
]);

const ARTIFACT_KINDS = {
  PAGE_INSPECTION: ['surface-inventory', 'action-inventory', 'unknowns'],
  JOURNEY_INSPECTION: ['journey-catalog', 'action-inventory', 'unknowns'],
  MODULE_INSPECTION: ['surface-inventory', 'action-inventory', 'journey-catalog', 'unknowns'],
  NAVIGATION_DISCOVERY: ['navigation-map', 'unknowns'],
  ROLE_INSPECTION: ['role-permission-matrix', 'unknowns'],
  PARITY_AUDIT: ['parity-matrix', 'unknowns'],
};

const TRANSIENT = /timeout|ECONNRESET|socket hang up|temporarily|429|503/i;

function countEntries(path) {
  if (!existsSync(path)) return 0;
  try {
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    for (const key of ['surfaces', 'actions', 'roles', 'journeys', 'nodes', 'rows', 'unknowns']) {
      if (Array.isArray(doc[key])) return doc[key].length;
    }
  } catch {
    return 0;
  }
  return 0;
}

async function dispatch(config, prompt, logger) {
  const { stdout, stderr } = await run(
    config.worker.runtime,
    ['run', '--agent', config.worker.agent, prompt],
    { timeout: 15 * 60 * 1000, cwd: REPO_ROOT, maxBuffer: 32 * 1024 * 1024 },
  );
  logger.event('info', 'worker_event', { stdoutBytes: stdout.length });
  if (stderr) logger.event('error', 'stderr', { stderr: stderr.slice(0, 4000) });
  return stdout;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const referenceId = args.reference;
  const target = args.target;
  const mode = args.mode ?? 'PAGE_INSPECTION';

  if (!referenceId || !target) {
    printCompact({
      STATUS: 'BLOCKED',
      MODE: 'INSPECT',
      REASON:
        'usage: pnpm ref:inspect --reference <id> --target <page|journey|module> [--mode MODE]',
    });
    return EXIT.USAGE;
  }
  if (!MODES.has(mode)) {
    printCompact({
      STATUS: 'BLOCKED',
      MODE: 'INSPECT',
      REASON: `unknown mode "${mode}"; expected one of ${[...MODES].join(', ')}`,
    });
    return EXIT.USAGE;
  }

  const reference = findReference(referenceId);
  const config = loadConfig(referenceId);
  const logDir = ensureDir(config.logPathAbsolute);
  const logger = createLogger(logDir, `inspect-${Date.now()}`);
  const base = {
    REFERENCE: referenceId,
    TARGET: target,
    MODE: mode,
    ACCESS: reference.accessPolicy,
    LOG: logger.path,
  };

  logger.event('info', 'inspection_start', { referenceId, target, mode });

  // Public-source-only references must never be inspected through a signed-in
  // session, regardless of what the browser currently holds.
  if (reference.accessPolicy === 'PUBLIC_SOURCE_ONLY' && !args['allow-public-source']) {
    printCompact({
      ...base,
      STATUS: 'BLOCKED',
      REASON: `${referenceId} is PUBLIC_SOURCE_ONLY under ${reference.authorityScope ? 'project governance' : 'policy'}; authenticated inspection is not permitted`,
      NEXT: 'study the listed public sources and record findings as DOC_VERIFIED, or change accessPolicy through a project decision',
      BLOCKERS: 'ACCESS_POLICY_PUBLIC_SOURCE_ONLY',
    });
    logger.event('info', 'blocked', { reason: 'ACCESS_POLICY_PUBLIC_SOURCE_ONLY' });
    return EXIT.BLOCKED;
  }

  // Preflight is a hard gate: the parent must not compensate for a dead session.
  try {
    const { stdout } = await run(
      process.execPath,
      [join(REPO_ROOT, 'scripts/reference/cdp-preflight.mjs'), '--reference', referenceId],
      { cwd: REPO_ROOT },
    );
    logger.event('info', 'preflight', { output: stdout.trim() });
  } catch (err) {
    const status = /AUTH_REQUIRED/.test(err.stdout ?? '') ? 'AUTH_REQUIRED' : 'REFERENCE_BLOCKED';
    printCompact({
      ...base,
      STATUS: status,
      REASON: (err.stdout ?? err.message).trim().split('\n').slice(-2).join(' '),
      NEXT:
        status === 'AUTH_REQUIRED' ? 'authenticate manually once, then retry' : 'pnpm ref:launch',
    });
    logger.event('error', 'preflight_failed', { status });
    return status === 'AUTH_REQUIRED' ? EXIT.AUTH_REQUIRED : EXIT.BLOCKED;
  }

  const kinds = ARTIFACT_KINDS[mode];
  const artifactDir = ensureDir(config.artifactPathAbsolute);
  const prompt = [
    `Mode: ${mode}`,
    `Reference: ${referenceId} (${reference.name})`,
    `Access policy: ${reference.accessPolicy}`,
    `Target: ${target}`,
    `Write these artifacts to ${config.artifactPath.replace('{referenceId}', referenceId)}: ${kinds.map((k) => `${k}.json`).join(', ')}`,
    'Follow .opencode/agents/reference-inspector.md and docs/REFERENCE_PARITY_PROTOCOL.md exactly.',
    'Inspect only the requested scope. Record unknowns as UNKNOWN. Return compact output only.',
  ].join('\n');

  // Bracket the run: the worker is read-only with respect to source, and that
  // is enforced by verification afterwards, not only by its tool permissions.
  const sourceBefore = snapshotSource();
  logger.event('info', 'source_snapshot', { head: sourceBefore.head, digest: sourceBefore.digest });

  let lastError = null;
  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    logger.event('info', 'attempt', { attempt, of: config.maxAttempts });
    try {
      await dispatch(config, prompt, logger);
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      logger.event('error', 'attempt_failed', { attempt, message: err.message.split('\n')[0] });
      if (!TRANSIENT.test(err.message) || attempt === config.maxAttempts) break;
      logger.event('info', 'retry', { attempt });
    }
  }

  const integrity = verifySource(sourceBefore);
  logger.event(integrity.ok ? 'info' : 'error', 'source_integrity', integrity);
  if (!integrity.ok) {
    // A policy violation outranks every other outcome, including a successful
    // capture. Never auto-accept and never silently repair.
    printCompact({
      ...base,
      STATUS: 'REFERENCE_WORKER_POLICY_VIOLATION',
      REASON: 'the reference worker modified paths outside the approved artifact roots',
      BLOCKERS: integrity.unauthorizedPaths.join(', '),
      NEXT: 'review and revert the unauthorized changes yourself; do not trust this run',
    });
    return EXIT.BLOCKED;
  }

  if (lastError) {
    printCompact({
      ...base,
      STATUS: 'REFERENCE_BLOCKED',
      REASON: lastError.message.split('\n')[0],
      BLOCKERS: `worker dispatch failed after ${config.maxAttempts} attempt(s)`,
      NEXT: 'pnpm ref:smoke to diagnose the worker; fix worker infrastructure only',
    });
    return EXIT.BLOCKED;
  }

  const validations = kinds
    .map((kind) => join(artifactDir, `${kind}.json`))
    .filter((path) => existsSync(path))
    .map(validateArtifact);
  const invalid = validations.filter((v) => !v.valid);
  const missing = kinds.filter((kind) => !existsSync(join(artifactDir, `${kind}.json`)));
  validations.forEach((v) =>
    logger.event(v.valid ? 'info' : 'error', 'artifact_validation', {
      kind: v.kind,
      errors: v.errors,
    }),
  );

  const partial = invalid.length > 0 || missing.length > 0;
  printCompact({
    ...base,
    STATUS: partial ? 'PARTIAL' : 'SUCCESS',
    SURFACES: countEntries(join(artifactDir, 'surface-inventory.json')),
    ACTIONS: countEntries(join(artifactDir, 'action-inventory.json')),
    ROLES: countEntries(join(artifactDir, 'role-permission-matrix.json')),
    JOURNEYS: countEntries(join(artifactDir, 'journey-catalog.json')),
    UNKNOWN: countEntries(join(artifactDir, 'unknowns.json')),
    ARTIFACTS: validations.filter((v) => v.valid).map((v) => v.path),
    BLOCKERS: partial
      ? [...missing.map((m) => `missing ${m}`), ...invalid.map((v) => `invalid ${v.kind}`)].join(
          '; ',
        )
      : 'NONE',
  });
  return partial ? EXIT.BLOCKED : EXIT.SUCCESS;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    printCompact({ STATUS: 'BLOCKED', MODE: 'INSPECT', REASON: err.message });
    process.exit(EXIT.BLOCKED);
  },
);
