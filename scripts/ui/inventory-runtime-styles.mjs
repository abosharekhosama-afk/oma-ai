#!/usr/bin/env node
/**
 * Final Planable style convergence — runtime style inventory.
 * Fails (exit 1) when zero-conditions are violated.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = [
  join(ROOT, 'packages/ui/src'),
  join(ROOT, 'apps/web/src/styles'),
  join(ROOT, 'apps/web/src/app'),
  join(ROOT, 'apps/web/src/components'),
];
const TOKEN_REL = 'packages/ui/src/tokens.css';
const SHARED_CSS = new Set([
  'packages/ui/src/tokens.css',
  'packages/ui/src/primitives.css',
  'packages/ui/src/motion.css',
]);
const OUT_DIR = join(ROOT, 'artifacts/planable-final-style-convergence-004');

const LEGACY_ALIAS =
  /--oma-violet|--oma-signal(?:-soft)?|--motion-micro|--motion-panel|--motion-ease|--shell-top-height|#6658[Ee]8|#121419/;
const HARD_HEX = /#[0-9a-fA-F]{3,8}\b/;
const INLINE_VISUAL =
  /style=\{\{[^}]*(?:background(?:Color)?|borderRadius|boxShadow|fontFamily)\s*:/g;
const CONTROL_RULE =
  /([^{}/][^{}]*\.(?:oma-btn|oma-input|oma-select|oma-textarea|oma-dialog|oma-drawer)\b[^{]*)\{([^{}]*)\}/g;
const VISUAL_PROP =
  /(?:^|;)\s*(?:background(?:-color)?|border(?:-radius|-color|-width|-style)?|box-shadow|color|outline|font-size|font-weight|line-height|min-height|height|padding|opacity|transition|animation)\s*:/i;
const LAYOUT_PROP =
  /(?:^|;)\s*(?:display|flex|flex-|grid|grid-|align-|justify-|gap|row-gap|column-gap|width|max-width|min-width|margin|position|inset|top|left|right|bottom|z-index|overflow|white-space|cursor|pointer-events|order|content)\s*:/i;

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(css|tsx|ts)$/.test(name) && !/\.(test|spec)\.ts$/.test(name)) acc.push(p);
  }
  return acc;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function hasIntentionalNear(text, index, end = index) {
  const start = Math.max(0, index - 200);
  return text.slice(start, Math.max(end, index) + 160).includes('INTENTIONAL_EXCEPTION');
}

function declValue(line, prop) {
  const m = line.match(new RegExp(`${prop}\\s*:\\s*([^;]+);`, 'i'));
  return m ? m[1].trim() : null;
}

function isRawRadius(line) {
  const v = declValue(line, 'border-radius');
  if (!v) return false;
  if (v.startsWith('var(') || v.startsWith('calc(var(')) return false;
  if (/^0(?:px|rem|em)?$/.test(v)) return false;
  if (v === '50%' || v === '999px' || v === 'inherit' || v === 'initial') return false;
  return true;
}

function isRawShadow(line) {
  const v = declValue(line, 'box-shadow');
  if (!v) return false;
  if (v.startsWith('var(') || v === 'none') return false;
  return true;
}

function isRawFont(line) {
  const v = declValue(line, 'font-family');
  if (!v) return false;
  // allow comma stacks only if every family token is var(...)
  const parts = v.split(',').map((p) => p.trim());
  return parts.some((p) => !p.startsWith('var('));
}

function isRawMotion(line) {
  if (!/(?:transition|animation)\s*:/.test(line)) return false;
  if (line.includes('var(--oma-motion') || line.includes('none')) return false;
  return (
    /\b(?:150|300)ms\b/.test(line) ||
    /cubic-bezier\(\s*0\.4\s*,\s*0\s*,\s*0\.2\s*,\s*1\s*\)/.test(line)
  );
}

const files = SCAN_ROOTS.flatMap((r) => walk(r));
const gaps = {
  hard_hex: [],
  raw_radius: [],
  raw_shadow: [],
  raw_font: [],
  raw_motion: [],
  runtime_legacy_alias: [],
  page_local_control_visual: [],
  inline_visual_style: [],
  intentional_layout: [],
};

for (const file of files) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, 'utf8');

  for (const m of text.matchAll(new RegExp(LEGACY_ALIAS.source, 'g'))) {
    gaps.runtime_legacy_alias.push({ file: rel, line: lineOf(text, m.index), match: m[0] });
  }

  if (file.endsWith('.css') && rel !== TOKEN_REL) {
    for (const [i, line] of text.split('\n').entries()) {
      if (line.includes('INTENTIONAL_EXCEPTION')) continue;
      if (HARD_HEX.test(line)) {
        gaps.hard_hex.push({ file: rel, line: i + 1, text: line.trim().slice(0, 140) });
      }
      if (isRawRadius(line)) {
        gaps.raw_radius.push({ file: rel, line: i + 1, text: line.trim().slice(0, 140) });
      }
      if (isRawShadow(line)) {
        gaps.raw_shadow.push({ file: rel, line: i + 1, text: line.trim().slice(0, 140) });
      }
      if (isRawFont(line)) {
        gaps.raw_font.push({ file: rel, line: i + 1, text: line.trim().slice(0, 140) });
      }
      if (isRawMotion(line)) {
        gaps.raw_motion.push({ file: rel, line: i + 1, text: line.trim().slice(0, 140) });
      }
    }
  }

  // Page/app CSS must not re-skin shared controls. Shared packages/ui is allowed.
  if (file.endsWith('.css') && !SHARED_CSS.has(rel)) {
    const stripped = text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
    for (const m of stripped.matchAll(CONTROL_RULE)) {
      const body = m[2];
      const nonLayoutVisual = [];
      for (const prop of body.split(';')) {
        const t = prop.trim();
        if (!t.includes(':')) continue;
        if (LAYOUT_PROP.test(`;${t}`)) continue;
        if (VISUAL_PROP.test(`;${t}`)) nonLayoutVisual.push(t.slice(0, 100));
      }
      if (nonLayoutVisual.length === 0) continue;
      const sel = m[1].trim().replace(/\s+/g, ' ').slice(0, 120);
      const entry = {
        file: rel,
        line: lineOf(text, m.index),
        sel,
        props: nonLayoutVisual.slice(0, 8),
      };
      if (hasIntentionalNear(text, m.index, m.index + m[0].length))
        gaps.intentional_layout.push(entry);
      else gaps.page_local_control_visual.push(entry);
    }
  }

  if (file.endsWith('.tsx')) {
    for (const m of text.matchAll(INLINE_VISUAL)) {
      if (hasIntentionalNear(text, m.index)) {
        gaps.intentional_layout.push({
          file: rel,
          line: lineOf(text, m.index),
          text: m[0].slice(0, 120),
        });
      } else {
        gaps.inline_visual_style.push({
          file: rel,
          line: lineOf(text, m.index),
          text: m[0].slice(0, 120),
        });
      }
    }
  }
}

const high =
  gaps.hard_hex.length +
  gaps.runtime_legacy_alias.length +
  gaps.page_local_control_visual.length +
  gaps.inline_visual_style.length;
const medium =
  gaps.raw_radius.length + gaps.raw_shadow.length + gaps.raw_font.length + gaps.raw_motion.length;

const report = {
  generatedAt: new Date().toISOString(),
  filesScanned: files.length,
  zeroConditions: {
    high_visual_gaps: high,
    medium_visual_gaps: medium,
    unexplained_duplicate_primitives: gaps.page_local_control_visual.length,
    page_local_control_visual_implementations: gaps.page_local_control_visual.length,
    runtime_legacy_aliases: gaps.runtime_legacy_alias.length,
    runtime_legacy_colors: gaps.hard_hex.length,
  },
  counts: Object.fromEntries(Object.entries(gaps).map(([k, v]) => [k, v.length])),
  gaps: Object.fromEntries(Object.entries(gaps).map(([k, v]) => [k, v.slice(0, 40)])),
  pass: high === 0 && medium === 0,
};

mkdirSync(OUT_DIR, { recursive: true });
const out = join(OUT_DIR, 'runtime-style-inventory.json');
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    { out, pass: report.pass, zeroConditions: report.zeroConditions, counts: report.counts },
    null,
    2,
  ),
);
process.exit(report.pass ? 0 : 1);
