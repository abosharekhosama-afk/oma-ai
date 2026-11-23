#!/usr/bin/env node
/**
 * Optional PurgeCSS dry-run. Install: pnpm add -D purgecss -w (not run in CI by default).
 * Usage: node scripts/css-audit/purgecss-run.mjs [--dry-run]
 */
import config from './purgecss.config.mjs';

const dry = process.argv.includes('--dry-run') || !process.argv.includes('--apply');
console.log(
  JSON.stringify(
    {
      mode: dry ? 'dry-run' : 'apply',
      note: 'Phase 3: run locally only; requires purgecss package and owner sign-off per CSS_ROUTE_OWNERSHIP.md',
      contentGlobs: config.content,
      safelist: config.safelist,
    },
    null,
    2,
  ),
);
