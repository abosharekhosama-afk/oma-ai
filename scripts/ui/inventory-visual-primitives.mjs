#!/usr/bin/env node
/**
 * Inventory duplicate / legacy visual primitives in apps/web.
 * Exit 0 always — prints JSON report for CI artifact / local review.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(process.cwd(), 'apps/web/src');
const OUT_DIR = join(process.cwd(), 'artifacts/planable-component-parity-004');

const PATTERNS = [
  { id: 'raw_hex', re: /#[0-9a-fA-F]{3,8}\b/g },
  { id: 'inline_border_radius', re: /border-radius:\s*[^;]+;/g },
  { id: 'box_shadow', re: /box-shadow:\s*[^;]+;/g },
  { id: 'oma_btn_class', re: /\boma-btn\b/g },
  { id: 'oma_input_class', re: /\boma-input\b/g },
  { id: 'oma_dialog_class', re: /\boma-dialog\b/g },
  { id: 'oma_drawer_class', re: /\boma-drawer\b/g },
  { id: 'legacy_violet', re: /--oma-violet|purple|#7[cC]3[aA][eE][dD]/g },
  { id: 'role_dialog', re: /role=["']dialog["']/g },
];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts|css)$/.test(name)) acc.push(p);
  }
  return acc;
}

const files = walk(ROOT);
const report = { generatedAt: new Date().toISOString(), filesScanned: files.length, hits: {} };

for (const pat of PATTERNS) report.hits[pat.id] = { count: 0, samples: [] };

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(process.cwd(), file);
  for (const pat of PATTERNS) {
    const matches = text.match(pat.re);
    if (!matches) continue;
    report.hits[pat.id].count += matches.length;
    if (report.hits[pat.id].samples.length < 12) {
      report.hits[pat.id].samples.push({ file: rel, n: matches.length });
    }
  }
}

mkdirSync(OUT_DIR, { recursive: true });
const out = join(OUT_DIR, 'visual-primitive-inventory.json');
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      out,
      filesScanned: report.filesScanned,
      summary: Object.fromEntries(Object.entries(report.hits).map(([k, v]) => [k, v.count])),
    },
    null,
    2,
  ),
);
