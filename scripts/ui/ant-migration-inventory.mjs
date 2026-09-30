#!/usr/bin/env node
/**
 * Readable Ant Design A2 migration inventory.
 * Default: write the report and exit 0.
 * `--check`: exit 1 while any MIGRATE finding remains.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = [join(ROOT, 'apps/web/src'), join(ROOT, 'packages/ui/src')];
const OUT = join(ROOT, 'docs/PLANABLE_ANT_DESIGN_A2_MIGRATION_INVENTORY.md');
const check = process.argv.includes('--check');

const CONTROL_TAGS = ['button', 'input', 'select', 'textarea'];
const LEGACY_HEX = /#6658[eE]8|#121419/g;

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, acc);
    else if (/\.(tsx|ts|css)$/.test(name)) acc.push(path);
  }
  return acc;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function classifyControl(file, tag, attrs) {
  const rel = relative(ROOT, file);
  if (rel.includes('components/demo/tasks-kanban-board') && tag === 'button') {
    return 'KEEP_DOMAIN_SPECIFIC';
  }
  if (rel.endsWith('packages/ui/src/controls.tsx')) return 'DOCUMENTED_EXCEPTION';
  if (/type=["']file["']/.test(attrs) || /type=["']hidden["']/.test(attrs)) {
    return 'KEEP_DOMAIN_SPECIFIC';
  }
  if (tag === 'button' && /oma-icon-btn|oma-btn|oma-link-btn|oma-card-button/.test(attrs)) {
    return 'MIGRATE';
  }
  if (tag === 'button') return 'MIGRATE';
  if (/oma-input|oma-select|oma-textarea|oma-checkbox/.test(attrs)) return 'MIGRATE';
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return 'MIGRATE';
  return 'MIGRATE';
}

function classifyCss(file, rule) {
  const rel = relative(ROOT, file);
  if (
    rel.startsWith('packages/ui/src/primitives.css') ||
    rel.startsWith('packages/ui/src/tokens.css')
  ) {
    return 'REMOVE_DUPLICATE';
  }
  if (/kanban|calendar|chart|svg|media/.test(rel) && /grid|position|width|height/.test(rule)) {
    return 'KEEP_LAYOUT_ONLY';
  }
  if (
    /\.(oma-btn|oma-input|oma-select|oma-textarea|oma-icon-btn|oma-dialog|oma-drawer)/.test(rule)
  ) {
    return 'REMOVE_DUPLICATE';
  }
  // Next Link + Ant button classes (OmaLinkButton) — intentional R2 adapter surface.
  if (/oma-link-button/.test(rule)) return 'DOCUMENTED_EXCEPTION';
  if (/\b(button|input|textarea|select)\b/.test(rule)) return 'MIGRATE';
  if (/kanban|calendar|chart|card|feed|row|pin|tab/.test(rule)) return 'KEEP_DOMAIN_SPECIFIC';
  return 'KEEP_LAYOUT_ONLY';
}

const findings = [];

function add(item) {
  findings.push(item);
}

for (const root of SCAN_ROOTS) {
  for (const file of walk(root)) {
    const text = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);

    if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const antd = /from ['"]antd['"]/g;
      for (const match of text.matchAll(antd)) {
        add({
          file: rel,
          line: lineOf(text, match.index ?? 0),
          kind: 'antd-import',
          detail: match[0],
          action:
            rel.endsWith('apps/web/src/components/ui/oma-antd-provider.tsx') ||
            rel.startsWith('packages/ui/')
              ? 'DOCUMENTED_EXCEPTION'
              : 'MIGRATE',
        });
      }

      const tagRe = /<(button|input|select|textarea)\b([^>]*)>/g;
      for (const match of text.matchAll(tagRe)) {
        const tag = match[1];
        const attrs = match[2] ?? '';
        if (tag === 'input' && /type=["'](hidden|file)["']/.test(attrs)) {
          add({
            file: rel,
            line: lineOf(text, match.index ?? 0),
            kind: 'native-control',
            detail: `<${tag}${attrs.slice(0, 80)}>`,
            action: 'KEEP_DOMAIN_SPECIFIC',
          });
          continue;
        }
        if (!CONTROL_TAGS.includes(tag)) continue;
        add({
          file: rel,
          line: lineOf(text, match.index ?? 0),
          kind: 'native-control',
          detail: `<${tag}${attrs.replace(/\s+/g, ' ').slice(0, 100)}>`,
          action: classifyControl(file, tag, attrs),
        });
      }
    }

    if (file.endsWith('.css')) {
      const ruleRe =
        /([^{}]+)\{[^}]*(?:border-radius|box-shadow|outline|min-height:\s*var\(--oma-control)[^}]*\}/g;
      for (const match of text.matchAll(ruleRe)) {
        const selector = match[1].replace(/\s+/g, ' ').trim().slice(0, 140);
        if (!selector || selector.startsWith('@')) continue;
        add({
          file: rel,
          line: lineOf(text, match.index ?? 0),
          kind: 'control-css',
          detail: selector,
          action: classifyCss(file, selector),
        });
      }
      LEGACY_HEX.lastIndex = 0;
      for (const match of text.matchAll(LEGACY_HEX)) {
        add({
          file: rel,
          line: lineOf(text, match.index ?? 0),
          kind: 'legacy-hex',
          detail: match[0],
          action: 'MIGRATE',
        });
      }
    }
  }
}

const counts = {};
for (const item of findings) {
  const key = `${item.action}:${item.kind}`;
  counts[key] = (counts[key] ?? 0) + 1;
}
const migrate = findings.filter((item) => item.action === 'MIGRATE');

const byFile = new Map();
for (const item of findings) {
  const list = byFile.get(item.file) ?? [];
  list.push(item);
  byFile.set(item.file, list);
}

const lines = [
  '# Planable Ant Design A2 migration inventory',
  '',
  'Generated by `pnpm ui:ant-migration-inventory`. Do not edit counts by hand.',
  '',
  `- Generated: ${new Date().toISOString()}`,
  `- Findings: ${findings.length}`,
  `- MIGRATE: ${migrate.length}`,
  '',
  '## Counts',
  '',
  '| Action | Kind | Count |',
  '| --- | --- | ---: |',
  ...Object.entries(counts)
    .sort()
    .map(([key, count]) => {
      const [action, kind] = key.split(':');
      return `| ${action} | ${kind} | ${count} |`;
    }),
  '',
  '## Classification',
  '',
  '- `MIGRATE`: replace with an `@oma/ui` Ant Design adapter.',
  '- `KEEP_LAYOUT_ONLY`: grid, canvas, or geometry that is not a control skin.',
  '- `KEEP_DOMAIN_SPECIFIC`: file input, hidden field, or Kanban drag control.',
  '- `REMOVE_DUPLICATE`: shared CSS that paints the same control Ant Design already owns.',
  '- `DOCUMENTED_EXCEPTION`: provider, registry, or the adapter module itself.',
  '',
  '## Findings',
  '',
];

for (const [file, items] of [...byFile.entries()].sort()) {
  lines.push(`### ${file}`, '');
  lines.push('| Line | Action | Kind | Detail |', '| ---: | --- | --- | --- |');
  for (const item of items) {
    const detail = item.detail.replace(/\|/g, '\\|');
    lines.push(`| ${item.line} | ${item.action} | ${item.kind} | \`${detail}\` |`);
  }
  lines.push('');
}

mkdirSync(join(ROOT, 'docs'), { recursive: true });
writeFileSync(OUT, `${lines.join('\n')}\n`);
const formatted = spawnSync(
  process.execPath,
  [join(ROOT, 'node_modules/prettier/bin/prettier.cjs'), '--write', OUT],
  { cwd: ROOT, stdio: 'inherit' },
);
if (formatted.status !== 0) process.exit(formatted.status ?? 1);
console.log(
  JSON.stringify(
    {
      out: relative(ROOT, OUT),
      findings: findings.length,
      migrate: migrate.length,
      counts,
    },
    null,
    2,
  ),
);
if (check && migrate.length > 0) process.exit(1);
