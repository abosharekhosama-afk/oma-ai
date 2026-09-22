import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(css|tsx|ts)$/.test(name) && !/\.(test|spec)\.ts$/.test(name)) acc.push(p);
  }
  return acc;
}

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

const ALIAS_RE =
  /--oma-violet|--oma-signal(?:-soft)?|--motion-micro|--motion-panel|--motion-ease|--shell-top-height|#6658[Ee]8|#121419/;

describe('Planable final style convergence guards', () => {
  it('passes runtime style inventory zero-conditions', () => {
    const r = spawnSync(process.execPath, ['scripts/ui/inventory-runtime-styles.mjs'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const report = JSON.parse(
      readFileSync(
        join(root, 'artifacts/planable-final-style-convergence-004/runtime-style-inventory.json'),
        'utf8',
      ),
    );
    expect(report.pass).toBe(true);
    expect(report.zeroConditions.high_visual_gaps).toBe(0);
    expect(report.zeroConditions.medium_visual_gaps).toBe(0);
    expect(report.zeroConditions.unexplained_duplicate_primitives).toBe(0);
    expect(report.zeroConditions.page_local_control_visual_implementations).toBe(0);
    expect(report.zeroConditions.runtime_legacy_aliases).toBe(0);
    expect(report.zeroConditions.runtime_legacy_colors).toBe(0);
  });

  it('keeps a single overlay scrim token and shared backdrop class', () => {
    const tokens = read('packages/ui/src/tokens.css');
    const primitives = read('packages/ui/src/primitives.css');
    expect(tokens.match(/--oma-overlay-scrim:/g)?.length).toBe(1);
    expect(primitives).toContain('.oma-overlay-backdrop');
    expect(primitives).toContain('var(--oma-overlay-scrim)');
    const hits: string[] = [];
    for (const file of walk(join(root, 'apps/web/src'))) {
      const text = readFileSync(file, 'utf8');
      if (
        /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.(4|45|5)\s*\)/.test(text) &&
        !text.includes('--oma-overlay-scrim')
      ) {
        // muted text uses 0.45 — exclude color tokens that are not overlays
        if (/background[^;]*rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.(4|45|5)/.test(text)) {
          hits.push(file.replace(root + '/', ''));
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('routes focus through tokenized elev-focus / focus-ring only', () => {
    const tokens = read('packages/ui/src/tokens.css');
    expect(tokens).toContain('--elev-focus:');
    expect(tokens).toContain('--elev-focus-strong:');
    expect(tokens).toContain('--elev-focus-danger:');
    expect(tokens).toContain('--focus-ring:');
    const primitives = read('packages/ui/src/primitives.css');
    expect(primitives).not.toMatch(/box-shadow:\s*0\s+0\s+0\s+[23]px\s+var\(--oma-focus-glow\)/);
    expect(primitives).toContain('var(--elev-focus)');
    expect(primitives).toContain('var(--elev-focus-strong)');
  });

  it('blocks runtime legacy aliases and unexplained hard hex outside tokens', () => {
    const roots = [
      'packages/ui/src',
      'apps/web/src/styles',
      'apps/web/src/app',
      'apps/web/src/components',
    ];
    const aliasHits: string[] = [];
    const hexHits: string[] = [];
    for (const dir of roots) {
      for (const file of walk(join(root, dir))) {
        const rel = file.replace(root + '/', '');
        const text = readFileSync(file, 'utf8');
        if (ALIAS_RE.test(text)) aliasHits.push(rel);
        if (rel.endsWith('.css') && !rel.endsWith('tokens.css')) {
          for (const [i, line] of text.split('\n').entries()) {
            if (line.includes('INTENTIONAL_EXCEPTION')) continue;
            if (/#[0-9a-fA-F]{3,8}\b/.test(line)) hexHits.push(`${rel}:${i + 1}`);
          }
        }
      }
    }
    expect(aliasHits).toEqual([]);
    expect(hexHits).toEqual([]);
  });

  it('exposes compact field variant on shared primitives', () => {
    const primitives = read('packages/ui/src/primitives.css');
    expect(primitives).toContain('.oma-select--compact');
    expect(primitives).toContain('.oma-input--compact');
    expect(primitives).toContain('.oma-drawer-title');
    expect(primitives).toContain('var(--radius-dialog)');
    expect(primitives).toContain('var(--elev-menu)');
  });
});
