import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  APPROVED_WRITE_ROOTS,
  PROTECTED_REFERENCE_PATHS,
  isApprovedWritePath,
  snapshotSource,
  verifySource,
} from '../../scripts/reference/lib/source-integrity.mjs';

/**
 * The guard exists because documented rules and editor tool denial cannot stop a
 * worker that reaches the filesystem some other way. These tests mutate a throwaway
 * git repository through those alternate routes and assert the guard still catches it.
 */
describe('reference inspector source-integrity guard', () => {
  let repo: string;

  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });

  const write = (relative: string, contents: string) => {
    mkdirSync(join(repo, relative, '..'), { recursive: true });
    writeFileSync(join(repo, relative), contents);
  };

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'oma-integrity-'));
    git('init', '--quiet');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'Integrity Test');
    write('apps/web/src/app/page.tsx', 'export default function Page() { return null; }\n');
    write('.reference/registry.json', '{"references":[]}\n');
    write('.reference/demo/surface-inventory.json', '{"meta":{},"surfaces":[]}\n');
    git('add', '.');
    git('commit', '--quiet', '-m', 'baseline');
  });

  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it('classifies approved artifact paths and protects source and committed inputs', () => {
    expect(APPROVED_WRITE_ROOTS).toEqual(['.reference/']);
    expect(isApprovedWritePath('.reference/semrush/surface-inventory.json')).toBe(true);
    expect(isApprovedWritePath('.reference/semrush/logs/run.jsonl')).toBe(true);
    expect(isApprovedWritePath('.reference/semrush/artifacts/shot.png')).toBe(true);

    expect(isApprovedWritePath('apps/web/src/app/page.tsx')).toBe(false);
    expect(isApprovedWritePath('packages/db/prisma/schema.prisma')).toBe(false);
    expect(isApprovedWritePath('specs/002-brand-website-intelligence/spec.md')).toBe(false);
    expect(isApprovedWritePath('package.json')).toBe(false);
    for (const protectedPath of PROTECTED_REFERENCE_PATHS) {
      expect(isApprovedWritePath(protectedPath)).toBe(false);
    }
  });

  it('A: an approved reference artifact write passes the guard', () => {
    const before = snapshotSource(repo);
    write('.reference/demo/action-inventory.json', '{"meta":{},"actions":[]}\n');

    const result = verifySource(before, repo);
    expect(result.status).toBe('SOURCE_INTEGRITY_OK');
    expect(result.ok).toBe(true);
    expect(result.unauthorizedPaths).toEqual([]);
    expect(result.artifactPaths).toContain('.reference/demo/action-inventory.json');
  });

  it('B: a source modification is detected as a policy violation', () => {
    const before = snapshotSource(repo);
    write('apps/web/src/app/page.tsx', 'export default function Page() { return "changed"; }\n');

    const result = verifySource(before, repo);
    expect(result.status).toBe('REFERENCE_WORKER_POLICY_VIOLATION');
    expect(result.ok).toBe(false);
    expect(result.unauthorizedPaths).toContain('apps/web/src/app/page.tsx');

    git('checkout', '--', 'apps/web/src/app/page.tsx');
  });

  it('C: writes through shell redirection, cp, mv, and node are all detected', () => {
    const cases: Array<[string, () => void]> = [
      [
        'shell redirection',
        () => execFileSync('sh', ['-c', 'echo hacked >> package.json'], { cwd: repo }),
      ],
      [
        'cp',
        () =>
          execFileSync('cp', ['.reference/registry.json', 'copied-into-source.json'], {
            cwd: repo,
          }),
      ],
      [
        'node',
        () =>
          execFileSync(
            process.execPath,
            ['-e', "require('node:fs').writeFileSync('via-node.txt','x')"],
            { cwd: repo },
          ),
      ],
      [
        'sed in place',
        () =>
          execFileSync('sh', ['-c', "sed -i'' -e 's/null/undefined/' apps/web/src/app/page.tsx"], {
            cwd: repo,
          }),
      ],
    ];

    for (const [mechanism, mutate] of cases) {
      const before = snapshotSource(repo);
      mutate();
      const result = verifySource(before, repo);
      expect(result.status, `${mechanism} should be detected`).toBe(
        'REFERENCE_WORKER_POLICY_VIOLATION',
      );
      expect(result.unauthorizedPaths.length).toBeGreaterThan(0);
      git('checkout', '--', '.');
      execFileSync('sh', ['-c', 'rm -f copied-into-source.json via-node.txt'], { cwd: repo });
    }
  });

  it('C2: rewriting a protected committed reference input is a violation', () => {
    const before = snapshotSource(repo);
    write('.reference/registry.json', '{"references":[{"referenceId":"injected"}]}\n');

    const result = verifySource(before, repo);
    expect(result.status).toBe('REFERENCE_WORKER_POLICY_VIOLATION');
    expect(result.unauthorizedPaths).toContain('.reference/registry.json');

    git('checkout', '--', '.reference/registry.json');
  });

  it('C3: a git-level history rewrite is detected', () => {
    const before = snapshotSource(repo);
    write('.reference/demo/journey-catalog.json', '{"meta":{},"journeys":[]}\n');
    git('add', '.');
    git('commit', '--quiet', '-m', 'worker commit');

    const result = verifySource(before, repo);
    expect(result.status).toBe('REFERENCE_WORKER_POLICY_VIOLATION');
    expect(result.unauthorizedPaths.some((p: string) => p.startsWith('HEAD:'))).toBe(true);
  });

  it('D+E: a mixed run reports the violation without discarding valid artifacts', () => {
    const before = snapshotSource(repo);
    write('.reference/demo/parity-matrix.json', '{"meta":{},"rows":[]}\n');
    write('apps/web/src/app/page.tsx', 'export default function Page() { return 1; }\n');

    const result = verifySource(before, repo);
    expect(result.status).toBe('REFERENCE_WORKER_POLICY_VIOLATION');
    expect(result.unauthorizedPaths).toContain('apps/web/src/app/page.tsx');
    // The artifact is still recorded; the guard reports, it does not repair.
    expect(result.artifactPaths).toContain('.reference/demo/parity-matrix.json');
    expect(
      execFileSync('cat', ['.reference/demo/parity-matrix.json'], { cwd: repo, encoding: 'utf8' }),
    ).toContain('rows');

    git('checkout', '--', 'apps/web/src/app/page.tsx');
  });
});
