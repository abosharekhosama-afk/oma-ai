#!/usr/bin/env node
/**
 * Conservative dead-class finder: classes in CSS with zero repo references.
 * Skips: ant-*, pseudo, short names, state prefixes likely toggled in JS.
 * Usage: node scripts/css-audit/find-dead-classes.mjs [--write-report]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const cssDir = join(root, 'apps/web/src/styles');
const reportPath = join(root, 'docs/CSS_DEAD_SELECTORS_REPORT.json');

const SKIP_PREFIX = /^(ant|css|rc|is|has|where|not)$/;
const DYNAMIC_PREFIX = /^(ant-|rc-|css-dev-only)/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (['node_modules', '.next', 'dist', 'coverage'].includes(name)) continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?|html|json|md|css)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const sources = [
  join(root, 'apps/web/src'),
  join(root, 'packages/ui/src'),
  join(root, 'packages/demo'),
];

let haystack = '';
for (const d of sources) walk(d).forEach((f) => (haystack += readFileSync(f, 'utf8') + '\n'));

const SELECTOR_RE = /\.([a-zA-Z][\w-]*)/g;

function referenced(className) {
  if (haystack.includes(className)) return true;
  try {
    const n = Number(
      execSync(
        `rg -l --glob '!**/node_modules/**' '${className.replace(/'/g, "\\'")}' '${root}' 2>/dev/null | wc -l`,
        {
          encoding: 'utf8',
        },
      ).trim(),
    );
    return n > 1; /* self in css + elsewhere */
  } catch {
    return haystack.includes(`"${className}"`) || haystack.includes(`'${className}'`);
  }
}

const cssFiles = readdirSync(cssDir)
  .filter((f) => f.endsWith('.css'))
  .map((f) => join(cssDir, f));

const report = {};

for (const file of cssFiles.sort()) {
  const css = readFileSync(file, 'utf8');
  const classes = new Set();
  let m;
  while ((m = SELECTOR_RE.exec(css)) !== null) {
    const c = m[1];
    if (SKIP_PREFIX.test(c) || c.length < 4) continue;
    if (DYNAMIC_PREFIX.test(c)) continue;
    classes.add(c);
  }
  const dead = [];
  const kept = [];
  for (const c of [...classes].sort()) {
    if (c.startsWith('oma-') || c.includes('__') || c.includes('--')) {
      kept.push(c);
      continue;
    }
    if (!referenced(c)) dead.push(c);
    else kept.push(c);
  }
  report[relative(root, file)] = { dead, deadCount: dead.length, scanned: classes.size };
}

const writeReport = process.argv.includes('--write-report');
if (writeReport) writeFileSync(reportPath, JSON.stringify(report, null, 2));

const totalDead = Object.values(report).reduce((a, v) => a + v.deadCount, 0);
console.log(
  JSON.stringify({ totalDead, files: Object.keys(report).length, sample: report }, null, 2),
);
