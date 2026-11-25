#!/usr/bin/env node
/**
 * Tier-0 CSS selector usage scan (conservative).
 * Reports class-like selectors not found in app source; skips state/dynamic patterns.
 *
 * Usage: node scripts/css-audit/scan-selectors.mjs [cssGlob...]
 * Default: apps/web/src/styles/stage{2,4,5}.css
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const defaultFiles = ['stage2.css', 'stage4.css', 'stage5.css'].map((f) =>
  join(root, 'apps/web/src/styles', f),
);

const args = process.argv.slice(2);
const cssFiles = args.length
  ? args.map((a) => (a.startsWith('/') ? a : join(root, a)))
  : defaultFiles;

const SOURCE_DIRS = [join(root, 'apps/web/src'), join(root, 'packages/ui/src')];

const sourceText = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      walk(p);
    } else if (/\.(tsx|ts|jsx|js|html|md)$/.test(name)) {
      sourceText.push(readFileSync(p, 'utf8'));
    }
  }
}
for (const d of SOURCE_DIRS) walk(d);
const haystack = sourceText.join('\n');

const SELECTOR_RE = /\.([a-zA-Z_][\w-]*)/g;
const SKIP_CLASS = new Set([
  'is',
  'has',
  'not',
  'where',
  'root',
  'hover',
  'focus',
  'active',
  'disabled',
  'first',
  'last',
  'nth',
  'aria',
  'dir',
  'lang',
  'media',
]);

const DYNAMIC_PATTERNS = [/^is-/, /^has-/, /^ant-/, /^oma-/, /^data-/, /^__/];

function likelyDynamic(className) {
  if (DYNAMIC_PATTERNS.some((p) => p.test(className))) return true;
  if (className.length <= 2) return true;
  return false;
}

const byFile = new Map();

for (const file of cssFiles) {
  const css = readFileSync(file, 'utf8');
  const classes = new Set();
  let m;
  while ((m = SELECTOR_RE.exec(css)) !== null) {
    const c = m[1];
    if (SKIP_CLASS.has(c)) continue;
    classes.add(c);
  }
  const missing = [];
  const skipped = [];
  for (const c of [...classes].sort()) {
    if (likelyDynamic(c)) {
      skipped.push(c);
      continue;
    }
    const patterns = [
      `className="${c}`,
      `className={\`${c}`,
      `'${c}'`,
      `"${c}"`,
      `\`${c}\``,
      `${c} `,
      ` ${c}`,
      `${c}'`,
      `${c}"`,
      `${c}\``,
    ];
    const found = patterns.some((p) => haystack.includes(p)) || haystack.includes(c);
    if (!found) missing.push(c);
  }
  byFile.set(file, { total: classes.size, missing, skipped: skipped.length });
}

console.log(
  JSON.stringify(
    {
      scanned: cssFiles.map((f) => relative(root, f)),
      byFile: Object.fromEntries([...byFile].map(([k, v]) => [relative(root, k), v])),
    },
    null,
    2,
  ),
);
