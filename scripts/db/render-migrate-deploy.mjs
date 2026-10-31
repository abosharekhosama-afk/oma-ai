#!/usr/bin/env node
/**
 * Render deploy helper: optionally mark a failed migration rolled-back once, then deploy.
 * Set OMA_RESOLVE_CONTENT_PUBLISH_TARGETS=1 on the service for a single redeploy after P3009.
 * Render must invoke `pnpm --filter @oma/db migrate:deploy`; `pnpm ... exec prisma migrate deploy`
 * bypasses package scripts and cannot run this recovery step.
 */
import { spawnSync } from 'node:child_process';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

if (process.env.OMA_RESOLVE_CONTENT_PUBLISH_TARGETS === '1') {
  run('pnpm', ['--filter', '@oma/db', 'migrate:resolve:content-publish-targets']);
}

run('pnpm', ['--filter', '@oma/db', 'exec', 'prisma', 'migrate', 'deploy']);
