import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('Tajawal Arabic product font', () => {
  it('hosts Tajawal faces for all product weights including semibold mapping', () => {
    const fonts = read('apps/web/src/styles/oma-fonts.css');
    expect(fonts).toContain("--font-tajawal: 'Tajawal', 'Tajawal Fallback'");
    expect(fonts).toContain('font-family: Tajawal;');
    for (const weight of [200, 300, 400, 500, 600, 700, 800, 900]) {
      expect(fonts).toContain(`font-weight: ${weight};`);
    }
    for (const file of [
      'Tajawal-200-arabic.woff2',
      'Tajawal-300-arabic.woff2',
      'Tajawal-400-arabic.woff2',
      'Tajawal-500-arabic.woff2',
      'Tajawal-700-arabic.woff2',
      'Tajawal-800-arabic.woff2',
      'Tajawal-900-arabic.woff2',
    ]) {
      expect(existsSync(join(root, 'apps/web/public/fonts/oma', file))).toBe(true);
      expect(fonts).toContain(file);
    }
  });

  it('wires Tajawal through tokens, Ant Design Arabic family, and AR body rules', () => {
    const tokens = read('packages/ui/src/tokens.css');
    const theme = read('packages/ui/src/antd-theme.ts');
    const globals = read('apps/web/src/app/globals.css');
    const typography = read('apps/web/src/styles/oma-typography-unified.css');
    const landing = read('apps/web/src/components/landing/landing.css');
    expect(tokens).toContain("'Tajawal'");
    expect(tokens).toContain('var(--font-tajawal)');
    expect(theme).toContain('var(--font-tajawal)');
    expect(globals).toContain("html[lang='ar'] body");
    expect(globals).toContain('var(--font-arabic)');
    expect(typography).toContain("html[lang='ar'] body");
    expect(typography).toContain('var(--font-arabic)');
    expect(landing).toContain('var(--font-tajawal)');
    expect(tokens).not.toContain('Noto Sans Arabic');
  });
});
