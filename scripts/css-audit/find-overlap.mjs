#!/usr/bin/env node
/**
 * Lists selectors that appear in multiple mobile-* CSS files (likely cascade fights).
 * Usage: pnpm css:audit:overlap
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const styleDir = join(root, 'apps/web/src/styles');

const mobileFiles = [
  ...readdirSync(styleDir)
    .filter((f) => f.startsWith('mobile-') && f.endsWith('.css'))
    .map((f) => join(styleDir, f)),
  join(root, 'apps/web/src/app/globals.css'),
];

const selectorRe = /([^{}\n/@][^{]*)\{/g;

function extractSelectors(css) {
  const set = new Set();
  let m;
  while ((m = selectorRe.exec(css))) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    if (sel.startsWith('@') || sel.includes('keyframes')) continue;
    if (sel.length > 3 && sel.length < 200) set.add(sel);
  }
  return set;
}

const bySelector = new Map();

for (const file of mobileFiles) {
  const path = file.endsWith('.css') && file.includes('/') ? file : join(styleDir, file);
  const rel = path.replace(root + '/', '');
  const css = readFileSync(path, 'utf8');
  for (const sel of extractSelectors(css)) {
    if (!bySelector.has(sel)) bySelector.set(sel, []);
    bySelector.get(sel).push(rel);
  }
}

const overlaps = [...bySelector.entries()]
  .filter(([, files]) => {
    const uniq = [...new Set(files)];
    return uniq.length >= 3 && uniq.some((f) => f.includes('mobile'));
  })
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 80);

const out = join(root, 'docs/CSS_MOBILE_OVERLAP_REPORT.txt');
const lines = [
  `# Mobile selector overlap (≥3 files) — ${new Date().toISOString().slice(0, 10)}`,
  '',
  ...overlaps.map(([sel, files]) => `${sel}\n  → ${[...new Set(files)].join('\n  → ')}`),
];
import { writeFileSync } from 'node:fs';
writeFileSync(out, lines.join('\n') + '\n');
console.log(`wrote ${out.replace(root + '/', '')} (${overlaps.length} hot selectors)`);
