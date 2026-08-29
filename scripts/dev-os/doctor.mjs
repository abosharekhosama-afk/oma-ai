#!/usr/bin/env node
/**
 * Reports what the Development OS can actually do right now. Diagnostic only:
 * it never installs or changes anything.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

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
  row(
    'REFERENCE INSPECTOR AGENT',
    file('.opencode/agents/reference-inspector.md') ? 'PASS' : 'BLOCKED',
    '.opencode/agents/reference-inspector.md',
  );
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

  const opencode = await which('opencode');
  row(
    'OPENCODE IMPLEMENTATION WORKER',
    opencode ? 'PASS' : 'NOT_CONFIGURED',
    opencode ?? 'opencode CLI not on PATH; routine implementation stays with the parent or Codex',
  );
  row(
    'OPENCODE REFERENCE WORKER',
    opencode ? 'PASS' : 'NOT_CONFIGURED',
    opencode
      ? 'agent definition present and CLI available'
      : 'agent definition present, CLI missing',
  );

  const codex = await which('codex');
  row('CODEX', codex ? 'PASS' : 'NOT_CONFIGURED', codex ?? 'codex CLI not on PATH');

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

  let cdp = 'NOT_CONFIGURED';
  let cdpDetail = 'reference CDP not running (expected unless inspecting)';
  const port = process.env.OMA_REFERENCE_CDP_PORT ?? '9333';
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const v = await res.json();
      cdp = 'PASS';
      cdpDetail = `${v.Browser} on 127.0.0.1:${port}`;
    }
  } catch {
    /* not running is the normal state */
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
