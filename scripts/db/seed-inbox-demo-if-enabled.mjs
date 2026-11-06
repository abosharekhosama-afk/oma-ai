/**
 * Runs inbox/listening demo seed only when SEED_INBOX_DEMO is truthy.
 * Safe to append to Render build/start commands.
 */
import { spawnSync } from 'node:child_process';

const raw = (process.env.SEED_INBOX_DEMO ?? '').trim().toLowerCase();
const enabled = raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';

if (!enabled) {
  console.log('[seed-inbox-demo] skipped (SEED_INBOX_DEMO not set)');
  process.exit(0);
}

console.log('[seed-inbox-demo] SEED_INBOX_DEMO enabled — running seed…');
const result = spawnSync('pnpm', ['--filter', '@oma/db', 'seed:inbox-demo'], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

process.exit(result.status === null ? 1 : result.status);
