import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { REPO_ROOT } from './config.mjs';

/**
 * The Reference Inspector is read-only with respect to application source, and
 * documented rules plus tool denial are not sufficient on their own: a worker
 * can reach the filesystem through shell redirection, node, python, sed, perl,
 * cp, mv, tee, cat, or git. So every real run is bracketed by a snapshot of the
 * working tree and verified afterwards. Writes outside the approved artifact
 * roots are detected regardless of the mechanism that produced them.
 */

/** Only these roots may change during an inspection. */
export const APPROVED_WRITE_ROOTS = ['.reference/'];

/** Committed inputs inside .reference/ that an inspection must not rewrite. */
export const PROTECTED_REFERENCE_PATHS = [
  '.reference/registry.json',
  '.reference/reference-config.default.json',
  '.reference/_schema/',
  '.reference/_fixtures/',
];

export function isApprovedWritePath(path) {
  const normalized = path.replace(/^\.\//, '');
  if (PROTECTED_REFERENCE_PATHS.some((p) => normalized === p || normalized.startsWith(p))) {
    return false;
  }
  return APPROVED_WRITE_ROOTS.some((root) => normalized.startsWith(root));
}

function git(args, cwd = REPO_ROOT) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/**
 * Captures tracked content and the untracked/ignored-file listing. `git
 * status --porcelain` alone would miss a modification that is later reverted
 * mid-run, so tracked content is hashed through the index.
 */
export function snapshotSource(cwd = REPO_ROOT) {
  const head = git(['rev-parse', 'HEAD'], cwd).trim();
  const treeListing = git(['ls-files', '-s'], cwd);
  const status = git(['status', '--porcelain', '--untracked-files=all'], cwd);

  const trackedByPath = new Map();
  for (const line of treeListing.split('\n')) {
    if (!line.trim()) continue;
    // <mode> <object> <stage>\t<path>
    const [meta, path] = line.split('\t');
    const parts = meta.split(' ');
    trackedByPath.set(path, `${parts[0]}:${parts[1]}`);
  }

  const worktreeByPath = new Map();
  for (const line of status.split('\n')) {
    if (!line.trim()) continue;
    worktreeByPath.set(line.slice(3).replace(/^"|"$/g, ''), line.slice(0, 2));
  }

  return {
    head,
    tracked: trackedByPath,
    worktree: worktreeByPath,
    digest: createHash('sha256').update(treeListing).update(status).digest('hex'),
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Compares a later state against the snapshot and classifies every changed
 * path. Unauthorized changes are never repaired here: silently reverting a
 * policy violation would hide it.
 */
export function verifySource(before, cwd = REPO_ROOT) {
  const after = snapshotSource(cwd);
  const changed = new Set();

  if (before.head !== after.head) {
    changed.add(`HEAD:${before.head}->${after.head}`);
  }
  for (const [path, id] of after.tracked) {
    if (before.tracked.get(path) !== id) changed.add(path);
  }
  for (const path of before.tracked.keys()) {
    if (!after.tracked.has(path)) changed.add(path);
  }
  for (const [path, state] of after.worktree) {
    if (before.worktree.get(path) !== state) changed.add(path);
  }
  for (const path of before.worktree.keys()) {
    if (!after.worktree.has(path)) changed.add(path);
  }

  const paths = [...changed];
  const unauthorized = paths.filter((p) => !isApprovedWritePath(p));
  const authorized = paths.filter((p) => isApprovedWritePath(p));

  return {
    ok: unauthorized.length === 0,
    status: unauthorized.length === 0 ? 'SOURCE_INTEGRITY_OK' : 'REFERENCE_WORKER_POLICY_VIOLATION',
    unauthorizedPaths: unauthorized.sort(),
    artifactPaths: authorized.sort(),
    before: before.digest,
    after: after.digest,
  };
}
