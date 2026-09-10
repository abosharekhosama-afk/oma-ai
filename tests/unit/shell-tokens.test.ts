import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Stage 1 design tokens', () => {
  const css = readFileSync(join(process.cwd(), 'packages/ui/src/tokens.css'), 'utf8');

  it('defines canonical color roles', () => {
    expect(css).toContain('--oma-primary: #6658e8');
    expect(css).toContain('--oma-signal: #12a7a1');
    expect(css).toContain('--oma-ink: #14151a');
    expect(css).toContain('--status-danger: #c43d4b');
  });

  it('defines shell geometry and elevation', () => {
    expect(css).toContain('--shell-rail-expanded: 240px');
    expect(css).toContain('--shell-rail-collapsed: 64px');
    expect(css).toContain('--shell-top-height: 56px');
    expect(css).toContain('--elev-1:');
    expect(css).toContain('--elev-2:');
  });

  it('defines type and motion tokens', () => {
    expect(css).toContain("--font-sans: 'IBM Plex Sans'");
    expect(css).toContain('--text-body: 14px');
    expect(css).toContain('--leading-body: 20px');
    expect(css).toContain('--motion-micro: 140ms');
  });
});
