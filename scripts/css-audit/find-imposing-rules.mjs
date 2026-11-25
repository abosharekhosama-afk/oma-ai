#!/usr/bin/env node
/**
 * Lists high-specificity mobile rules that override responsive defaults (cascade fights).
 * Output: docs/CSS_IMPOSING_RULES_REPORT.txt
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const targets = [
  join(root, 'apps/web/src/app/globals.css'),
  join(root, 'apps/web/src/styles/stage4.css'),
  join(root, 'apps/web/src/styles/stage5.css'),
  ...readdirSync(join(root, 'apps/web/src/styles'))
    .filter((f) => f.startsWith('mobile-'))
    .map((f) => join(root, 'apps/web/src/styles', f)),
];

const PATTERNS = [
  /min-width:\s*9\d{2}px/i,
  /display:\s*block\s*!important[\s\S]{0,120}oma-req-desktop/,
  /oma-req-mobile[\s\S]{0,80}display:\s*none/i,
  /oma-deliv-mobile[\s\S]{0,80}display:\s*none/i,
];

const lines = [];
for (const file of targets) {
  const css = readFileSync(file, 'utf8');
  const rel = relative(root, file);
  PATTERNS.forEach((re) => {
    if (re.test(css)) {
      lines.push(`${rel}: matched ${re.source.slice(0, 60)}…`);
    }
  });
  const count = (css.match(/!important/g) || []).length;
  lines.push(`${rel}: !important count = ${count}`);
}

const out = join(root, 'docs/CSS_IMPOSING_RULES_REPORT.txt');
writeFileSync(out, lines.join('\n') + '\n');
console.log('wrote', relative(root, out), lines.length, 'lines');
