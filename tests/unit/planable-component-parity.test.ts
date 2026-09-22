import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(process.cwd());

describe('Planable component parity primitives', () => {
  const tokens = readFileSync(join(root, 'packages/ui/src/tokens.css'), 'utf8');
  const primitives = readFileSync(join(root, 'packages/ui/src/primitives.css'), 'utf8');
  const dialog = readFileSync(join(root, 'apps/web/src/components/ui/dialog.tsx'), 'utf8');

  it('keeps Planable LIVE color and type contract', () => {
    expect(tokens).toMatch(/--oma-canvas:\s*#f5f6f7/i);
    expect(tokens).toMatch(/--oma-ink:\s*#333333/i);
    expect(tokens).toMatch(/--oma-primary:\s*#1677ff/i);
    expect(tokens).toMatch(/--text-body:\s*14px/);
    expect(tokens).toMatch(/--oma-radius-control:\s*6px/);
  });

  it('uses measured motion and overlay tokens', () => {
    expect(tokens).toMatch(/--oma-motion-control:\s*300ms/);
    expect(tokens).toMatch(/--oma-motion-sidebar:\s*150ms/);
    expect(tokens).toMatch(/--oma-overlay-scrim/);
    expect(tokens).toMatch(/--elev-dialog/);
    expect(tokens).toMatch(/--oma-control-height-compact:\s*30px/);
  });

  it('defines professional dialog structure classes', () => {
    expect(primitives).toMatch(/\.oma-dialog-header/);
    expect(primitives).toMatch(/\.oma-dialog-body/);
    expect(primitives).toMatch(/\.oma-dialog-footer/);
    expect(dialog).toMatch(/oma-dialog-header/);
    expect(dialog).toMatch(/oma-dialog-body/);
    expect(dialog).toMatch(/oma-icon-btn/);
  });

  it('strengthens form hover/focus/error/disabled states', () => {
    expect(primitives).toMatch(/\.oma-input:hover/);
    expect(primitives).toMatch(/\.oma-input:focus-visible/);
    expect(primitives).toMatch(/aria-invalid/);
    expect(primitives).toMatch(/\.oma-textarea/);
    expect(primitives).toMatch(/\.oma-btn:active/);
  });
});
