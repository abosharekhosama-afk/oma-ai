#!/usr/bin/env node
/**
 * Reports what the Development OS can actually do right now. Diagnostic only:
 * it never installs or changes anything.
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { LOOPBACK_HOSTS, resolveCdpEndpoint } from '../reference/lib/config.mjs';
import {
  APPROVED_WRITE_ROOTS,
  PROTECTED_REFERENCE_PATHS,
  isApprovedWritePath,
  snapshotSource,
  verifySource,
} from '../reference/lib/source-integrity.mjs';

const run = promisify(execFile);
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const rows = [];
function row(area, status, detail) {
  rows.push({ area, status, detail });
}

async function which(bin) {
  try {
    const { stdout } = await run(process.platform === 'win32' ? 'where' : 'which', [bin]);
    return stdout.trim().split('\n')[0] || null;
  } catch {
    return null;
  }
}

function file(path) {
  return existsSync(join(REPO_ROOT, path));
}

async function main() {
  row(
    'CURSOR RULES',
    file('.cursor/rules/oma-orchestrator.mdc') ? 'PASS' : 'BLOCKED',
    '.cursor/rules/oma-orchestrator.mdc',
  );
  row('AGENTS CONTRACT', file('AGENTS.md') ? 'PASS' : 'BLOCKED', 'AGENTS.md');
  row(
    'SPEC KIT',
    file('.specify/workflows/workflow-registry.json') ? 'PASS' : 'BLOCKED',
    '.specify',
  );
  row(
    'SPEC AUDITOR',
    file('.cursor/agents/oma-spec-auditor.md') ? 'PASS' : 'BLOCKED',
    'oma-spec-auditor',
  );
  row('VERIFIER', file('.cursor/agents/oma-verifier.md') ? 'PASS' : 'BLOCKED', 'oma-verifier');
  row(
    'REFERENCE PROTOCOL',
    file('docs/REFERENCE_PARITY_PROTOCOL.md') ? 'PASS' : 'BLOCKED',
    'docs/REFERENCE_PARITY_PROTOCOL.md',
  );
  const inspectorContract = file('.opencode/agents/reference-inspector.md');
  row(
    'REFERENCE INSPECTOR CONTRACT',
    inspectorContract ? 'PASS' : 'BLOCKED',
    '.opencode/agents/reference-inspector.md',
  );
  row(
    'SOURCE CODE ACCESS',
    !isApprovedWritePath('apps/web/src/app/page.tsx') &&
      !isApprovedWritePath('packages/db/prisma/schema.prisma')
      ? 'READ_ONLY'
      : 'FAIL',
    'application source is outside every approved write root',
  );
  row(
    'ARTIFACT OUTPUT',
    isApprovedWritePath('.reference/semrush/surface-inventory.json') &&
      !isApprovedWritePath('.reference/registry.json')
      ? 'RESTRICTED_WRITE_ALLOWED'
      : 'FAIL',
    'evidence writable, committed reference inputs protected',
  );
  row('APPROVED ARTIFACT ROOTS', 'PASS', APPROVED_WRITE_ROOTS.join(', '));
  row('PROTECTED REFERENCE INPUTS', 'PASS', PROTECTED_REFERENCE_PATHS.join(', '));
  try {
    const guard = verifySource(snapshotSource());
    row(
      'SOURCE INTEGRITY GUARD',
      guard.status === 'SOURCE_INTEGRITY_OK' ? 'PASS' : 'BLOCKED',
      `self-check ${guard.status}`,
    );
  } catch (err) {
    row('SOURCE INTEGRITY GUARD', 'BLOCKED', err.message.split('\n')[0]);
  }
  row(
    'REFERENCE REGISTRY',
    file('.reference/registry.json') ? 'PASS' : 'BLOCKED',
    '.reference/registry.json',
  );
  row(
    'ARTIFACT SCHEMAS',
    file('.reference/_schema/schemas.json') ? 'PASS' : 'BLOCKED',
    '.reference/_schema/schemas.json',
  );

  // Route and runtime are reported separately: a wired, documented route is not
  // evidence that the worker can actually execute.
  const opencode = await which('opencode');
  row('OPENCODE ROUTE', 'CONFIGURED_IN_OS', 'docs/CURSOR_WORKFLOW.md agent routing table');
  row('OPENCODE CLI', opencode ? 'AVAILABLE' : 'NOT_CONFIGURED', opencode ?? 'not on PATH');
  row(
    'REFERENCE INSPECTOR RUNTIME',
    opencode ? 'AVAILABLE' : 'NOT_CONFIGURED',
    opencode
      ? 'contract present and CLI available; run pnpm ref:smoke to verify'
      : 'contract present, CLI missing — runtime unverified',
  );

  const codex = await which('codex');
  row('CODEX ROUTE', 'PRESERVED', 'docs/CURSOR_WORKFLOW.md agent routing table');
  row('CODEX CLI', codex ? 'AVAILABLE' : 'NOT_CONFIGURED', codex ?? 'not on PATH');

  row(
    'PLAYWRIGHT APPLICATION E2E',
    file('playwright.config.ts') && file('tests/e2e') ? 'PASS' : 'BLOCKED',
    'playwright.config.ts + tests/e2e',
  );

  const chromeCandidates =
    {
      darwin: [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ],
      linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
      win32: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'],
    }[process.platform] ?? [];
  const chrome = chromeCandidates.find((c) => existsSync(c)) ?? null;
  row(
    'CHROME',
    chrome ? 'PASS' : 'NOT_CONFIGURED',
    chrome ?? `no Chrome found for ${process.platform}`,
  );

  let endpoint = null;
  try {
    endpoint = resolveCdpEndpoint();
    row('CANONICAL CDP SOURCE', 'PASS', endpoint.source);
    row(
      'CANONICAL CDP ENDPOINT',
      'PASS',
      `${endpoint.endpoint}${endpoint.overridden ? ' (test override via OMA_REFERENCE_CDP_PORT)' : ''}`,
    );
    row(
      'CDP LOCAL ONLY',
      LOOPBACK_HOSTS.includes(endpoint.host) ? 'PASS' : 'BLOCKED',
      endpoint.host,
    );
  } catch (err) {
    row('CANONICAL CDP SOURCE', 'BLOCKED', err.message);
    row('CDP LOCAL ONLY', 'BLOCKED', err.message);
  }

  let cdp = 'NOT_CONFIGURED';
  let cdpDetail = 'reference CDP not running (expected unless inspecting)';
  if (endpoint) {
    try {
      const res = await fetch(`${endpoint.endpoint}/json/version`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const v = await res.json();
        cdp = 'PASS';
        cdpDetail = `${v.Browser} on ${endpoint.endpoint}`;
      }
    } catch {
      /* not running is the normal state */
    }
  }
  row('REFERENCE CDP', cdp, cdpDetail);
  row(
    'REFERENCE PROFILE',
    existsSync(join(REPO_ROOT, '.reference/.chrome-profile')) ? 'PASS' : 'NOT_CONFIGURED',
    '.reference/.chrome-profile (created by pnpm ref:launch)',
  );
  row(
    'MCP',
    file('.cursor/mcp.json') || file('.opencode/mcp.json') ? 'PASS' : 'NOT_CONFIGURED',
    'Playwright MCP config for the inspector',
  );

  const git = await which('git');
  row('GIT', git ? 'PASS' : 'BLOCKED', git ?? 'git missing');
  try {
    const { stdout } = await run('git', ['status', '--porcelain'], { cwd: REPO_ROOT });
    const dirty = stdout.trim().split('\n').filter(Boolean).length;
    row(
      'WORKTREE',
      dirty === 0 ? 'PASS' : 'WARN',
      dirty === 0 ? 'clean' : `${dirty} uncommitted path(s)`,
    );
  } catch {
    row('WORKTREE', 'WARN', 'unable to read git status');
  }

  const gh = await which('gh');
  if (gh) {
    try {
      await run('gh', ['auth', 'status']);
      row('GH AUTH', 'PASS', 'authenticated');
    } catch {
      row('GH AUTH', 'WARN', 'gh present but not authenticated');
    }
  } else {
    row('GH AUTH', 'NOT_CONFIGURED', 'gh CLI not on PATH');
  }

  row(
    'DB TOOLING',
    file('packages/db/prisma/schema.prisma') ? 'PASS' : 'NOT_REQUIRED',
    'prisma schema',
  );
  row(
    'MODEL ROUTES',
    file('docs/CURSOR_WORKFLOW.md') ? 'PASS' : 'BLOCKED',
    'docs/CURSOR_WORKFLOW.md agent routing table',
  );

  // Every registered reference must carry an explicit access policy, and a
  // public-source reference must never be reachable through an authenticated
  // flow. This is project governance, enforced against the generic subsystem.
  try {
    const registry = JSON.parse(readFileSync(join(REPO_ROOT, '.reference/registry.json'), 'utf8'));
    const policies = registry.references.map((r) => r.accessPolicy);
    const missing = registry.references.filter((r) => !r.accessPolicy).length;
    const publicOnly = policies.filter((p) => p === 'PUBLIC_SOURCE_ONLY').length;
    row(
      'PUBLIC-SOURCE ACCESS POLICY',
      missing === 0 ? 'PASS' : 'BLOCKED',
      missing === 0
        ? `${publicOnly}/${policies.length} reference(s) PUBLIC_SOURCE_ONLY (DEC-013)`
        : `${missing} reference(s) missing accessPolicy`,
    );
  } catch (err) {
    row('PUBLIC-SOURCE ACCESS POLICY', 'BLOCKED', err.message.split('\n')[0]);
  }

  try {
    await run(process.execPath, [join(REPO_ROOT, 'scripts/dev-os/validate-development-os.mjs')], {
      cwd: REPO_ROOT,
    });
    row('DEVELOPMENT OS', 'VALID', 'pnpm devos:validate');
  } catch {
    row('DEVELOPMENT OS', 'BLOCKED', 'pnpm devos:validate reports DEVELOPMENT_OS_INVALID');
  }

  const width = Math.max(...rows.map((r) => r.area.length));
  for (const r of rows) {
    process.stdout.write(`${r.area.padEnd(width)}  ${r.status.padEnd(15)}  ${r.detail}\n`);
  }
  const blocked = rows.filter((r) => r.status === 'BLOCKED');
  process.stdout.write(`\nSTATUS: ${blocked.length ? 'BLOCKED' : 'PASS'}\n`);
  if (blocked.length) {
    process.stdout.write(`BLOCKERS: ${blocked.map((r) => r.area).join(', ')}\n`);
  }
  return blocked.length ? 1 : 0;
}

main().then((code) => process.exit(code));
