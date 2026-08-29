#!/usr/bin/env node
/**
 * Proves the reference worker is usable without touching a browser, so an
 * inspection failure can be attributed to the worker, the CDP session, or the
 * reference itself rather than guessed at.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { REPO_ROOT, loadConfig, parseArgs } from './lib/config.mjs';
import { EXIT, printCompact } from './lib/compact.mjs';

const run = promisify(execFile);
const EXPECTED = 'REFERENCE_INSPECTOR_READY';

async function which(bin) {
  try {
    const { stdout } = await run(process.platform === 'win32' ? 'where' : 'which', [bin]);
    return stdout.trim().split('\n')[0] || null;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.reference ?? null);
  const checks = [];

  const agentPath = join(REPO_ROOT, '.opencode/agents/reference-inspector.md');
  checks.push({
    name: 'agent-definition',
    status: existsSync(agentPath) ? 'PASS' : 'BLOCKED',
    detail: agentPath,
  });

  const cli = await which(config.worker.runtime);
  if (!cli) {
    checks.push({
      name: 'worker-cli',
      status: 'NOT_CONFIGURED',
      detail: `${config.worker.runtime} not on PATH`,
    });
    printCompact({
      STATUS: 'NOT_CONFIGURED',
      MODE: 'WORKER_SMOKE',
      REASON: `${config.worker.runtime} CLI is not installed; reference inspection cannot run`,
      NEXT: 'install and authenticate the worker CLI, then re-run pnpm ref:smoke',
      BLOCKERS: checks
        .filter((c) => c.status !== 'PASS')
        .map((c) => `${c.name}=${c.status}`)
        .join(' '),
    });
    // Not installed is a configuration gap, not a broken system.
    return EXIT.SUCCESS;
  }
  checks.push({ name: 'worker-cli', status: 'PASS', detail: cli });

  // Deterministic round trip: the worker must echo an exact token back.
  let roundTrip = { status: 'BLOCKED', detail: 'no response' };
  try {
    const { stdout } = await run(
      cli,
      ['run', '--agent', config.worker.agent, `Reply with exactly: ${EXPECTED}`],
      { timeout: 60000, cwd: REPO_ROOT },
    );
    roundTrip = stdout.includes(EXPECTED)
      ? { status: 'PASS', detail: 'expected token returned' }
      : { status: 'BLOCKED', detail: 'worker responded without the expected token' };
  } catch (err) {
    roundTrip = { status: 'BLOCKED', detail: err.message.split('\n')[0] };
  }
  checks.push({ name: 'worker-round-trip', ...roundTrip });

  const failed = checks.filter((c) => c.status === 'BLOCKED');
  printCompact({
    STATUS: failed.length ? 'BLOCKED' : 'SUCCESS',
    MODE: 'WORKER_SMOKE',
    REASON: checks.map((c) => `${c.name}=${c.status}`).join(' '),
    BLOCKERS: failed.length ? failed.map((c) => `${c.name}: ${c.detail}`).join('; ') : 'NONE',
    NEXT: failed.length ? 'diagnose the worker before any inspection' : 'pnpm ref:preflight',
  });
  return failed.length ? EXIT.BLOCKED : EXIT.SUCCESS;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    printCompact({ STATUS: 'BLOCKED', MODE: 'WORKER_SMOKE', REASON: err.message });
    process.exit(EXIT.BLOCKED);
  },
);
