import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  LOOPBACK_HOSTS,
  assertLoopback,
  resolveCdpEndpoint,
} from '../../scripts/reference/lib/config.mjs';

const REPO_ROOT = join(__dirname, '../..');

function runScript(relative: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  try {
    const stdout = execFileSync(process.execPath, [join(REPO_ROOT, relative), ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
    return { code: 0, stdout };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, stdout: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('canonical CDP configuration', () => {
  it('resolves through one source of truth', () => {
    const resolved = resolveCdpEndpoint();
    const canonical = JSON.parse(
      readFileSync(join(REPO_ROOT, '.reference/reference-config.default.json'), 'utf8'),
    );

    expect(resolved.source).toBe('.reference/reference-config.default.json#cdp');
    expect(resolved.host).toBe(canonical.cdp.host);
    expect(resolved.port).toBe(canonical.cdp.port);
    expect(resolved.endpoint).toBe(`http://${canonical.cdp.host}:${canonical.cdp.port}`);
    expect(resolved.overridden).toBe(false);
  });

  it('accepts only loopback hosts', () => {
    for (const host of LOOPBACK_HOSTS) {
      expect(assertLoopback(host)).toBe(host);
    }
    for (const host of ['0.0.0.0', '192.168.1.10', 'reference.internal', '::']) {
      expect(() => assertLoopback(host)).toThrowError(/CDP_NOT_LOOPBACK/);
    }
  });

  it('keeps the operational endpoint out of every consumer', () => {
    const consumers = [
      'scripts/reference/launch-reference-browser.mjs',
      'scripts/reference/cdp-preflight.mjs',
      'scripts/reference/inspect-reference.mjs',
      'scripts/reference/playwright-mcp.mjs',
      'scripts/dev-os/doctor.mjs',
      '.opencode/mcp.json',
    ];
    for (const path of consumers) {
      const content = readFileSync(join(REPO_ROOT, path), 'utf8');
      expect(content, `${path} must not carry its own endpoint literal`).not.toMatch(
        /9222|9333|59999/,
      );
    }
  });

  it('lets a test override the endpoint without mutating canonical configuration', () => {
    const canonicalBefore = readFileSync(
      join(REPO_ROOT, '.reference/reference-config.default.json'),
      'utf8',
    );

    // Port 1 is reachable by nothing, so preflight must report the endpoint down
    // rather than silently falling back to the canonical port.
    const result = runScript('scripts/reference/cdp-preflight.mjs', ['--reference', 'semrush'], {
      OMA_REFERENCE_CDP_PORT: '1',
    });
    expect(result.stdout).toContain('STATUS: CDP_UNAVAILABLE');
    expect(result.stdout).toContain('http://127.0.0.1:1');

    expect(readFileSync(join(REPO_ROOT, '.reference/reference-config.default.json'), 'utf8')).toBe(
      canonicalBefore,
    );
  });
});

describe('OMA DEC-013 access policy', () => {
  const registry = JSON.parse(
    readFileSync(join(REPO_ROOT, '.reference/registry.json'), 'utf8'),
  ) as { references: Array<{ referenceId: string; accessPolicy: string }> };

  it('keeps non-Planable registered OMA references public-source-only', () => {
    expect(registry.references.length).toBeGreaterThan(0);
    for (const reference of registry.references) {
      if (reference.referenceId === 'planable') {
        expect(reference.accessPolicy, 'planable access policy').toBe('AUTHENTICATED_ALLOWED');
        continue;
      }
      expect(reference.accessPolicy, `${reference.referenceId} access policy`).toBe(
        'PUBLIC_SOURCE_ONLY',
      );
    }
  });

  it('refuses an inspection run against a public-source-only reference', () => {
    const result = runScript('scripts/reference/inspect-reference.mjs', [
      '--reference',
      'semrush',
      '--target',
      'site audit',
      '--mode',
      'PAGE_INSPECTION',
    ]);

    expect(result.code).not.toBe(0);
    expect(result.stdout).toContain('STATUS: BLOCKED');
    expect(result.stdout).toContain('ACCESS_POLICY_PUBLIC_SOURCE_ONLY');
    // The refusal must happen before any browser work is attempted.
    expect(result.stdout).not.toContain('SURFACES:');
  });
});

describe('generic reference infrastructure', () => {
  it('carries no foreign project reference names', () => {
    const generic = [
      'scripts/reference/lib/config.mjs',
      'scripts/reference/lib/source-integrity.mjs',
      'scripts/reference/inspect-reference.mjs',
      'scripts/reference/cdp-preflight.mjs',
      'scripts/reference/parity-report.mjs',
      'scripts/reference/validate-reference-artifacts.mjs',
      '.reference/_schema/schemas.json',
    ];
    for (const path of generic) {
      const content = readFileSync(join(REPO_ROOT, path), 'utf8');
      expect(content, `${path} must stay project-neutral`).not.toMatch(
        /zoho|teamworks|sportdata|imkan one/i,
      );
    }
  });
});
