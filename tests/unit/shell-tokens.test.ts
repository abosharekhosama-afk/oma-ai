import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tokens } from '../../packages/ui/src/index';

describe('P1 Planable design tokens', () => {
  const css = readFileSync(join(process.cwd(), 'packages/ui/src/tokens.css'), 'utf8');

  it('defines a single Planable color system', () => {
    expect(css).toContain('--oma-primary: #1677ff');
    expect(css).toContain('--oma-canvas: #f5f6f7');
    expect(css).toContain('--oma-ink: #333333');
    expect(css).toContain('--oma-surface: #ffffff');
    expect(css).not.toContain('--oma-primary: #6658e8');
    expect(css).not.toMatch(/IBM Plex/);
    expect(css).not.toContain("'Inter'");
    expect(tokens.primary).toBe('#1677FF');
    expect(tokens.railExpanded).toBe(256);
  });

  it('defines Planable shell geometry and control metrics', () => {
    expect(css).toContain('--shell-rail-expanded: 256px');
    expect(css).toContain('--oma-control-height: 32px');
    expect(css).toContain('--oma-radius-control: 6px');
    expect(css).toContain('--oma-motion-sidebar: 150ms');
    expect(css).toContain('--oma-motion-control: 300ms');
    expect(css).toContain('--text-body: 14px');
    expect(css).toContain('--leading-body: 22px');
  });

  it('uses system-UI English stack and Noto Arabic adaptation', () => {
    expect(css).toContain('-apple-system');
    expect(css).toContain("'Segoe UI'");
    expect(css).toContain("'Noto Sans Arabic'");
    expect(css).toContain('--shell-header-height');
    expect(css).not.toContain('P1_COMPAT');
  });

  it('keeps a single :root token sheet and no English webfont product face', () => {
    const glob = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
    const globals = glob('apps/web/src/app/globals.css');
    const layout = glob('apps/web/src/app/layout.tsx');
    const stageFiles = [
      'apps/web/src/styles/stage2.css',
      'apps/web/src/styles/stage3.css',
      'apps/web/src/styles/stage4.css',
      'apps/web/src/styles/stage5.css',
      'apps/web/src/styles/stage6.css',
      'apps/web/src/styles/stage-depth.css',
      'apps/web/src/styles/shell.css',
    ].map(glob);
    expect(globals).toContain('packages/ui/src/tokens.css');
    expect(layout).not.toMatch(/\bInter\b/);
    expect(layout).not.toContain('IBM_Plex');
    expect(layout).toContain('Noto_Sans_Arabic');
    for (const file of stageFiles) {
      expect(file).not.toMatch(/(^|\n):root\s*\{/);
      expect(file).not.toContain('--oma-primary: #6658');
    }
  });
});
