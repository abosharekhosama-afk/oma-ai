import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../packages/i18n/messages/en.json';
import ar from '../../packages/i18n/messages/ar.json';

const root = join(__dirname, '../..');
const dirs = [
  'apps/web/src/components/strategy',
  'apps/web/src/app/(app)/app/brands/[brandId]/strategies',
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(name) ? [p] : [];
  });
}

const enMap = en as Record<string, string>;
const arMap = ar as Record<string, string>;

describe('strategy screens: i18n key coverage', () => {
  const keys = new Set<string>();
  for (const d of dirs) {
    for (const f of files(join(root, d))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'\s*\)/g)) keys.add(m[1]!);
    }
  }

  it('finds the strategy keys', () => {
    expect(keys.size).toBeGreaterThan(100);
  });

  it('every literal key exists in EN and AR', () => {
    const missing = [...keys].filter((k) => !(k in enMap) || !(k in arMap));
    expect(missing).toEqual([]);
  });

  it('Arabic strategy copy is not left in English', () => {
    const allowed = /^(CTA|SEO|KPI|URL|GSC|ROAS|CPA|CTR|H1|Meta|Google Search Console|DataForSEO)$/;
    const english = [...keys].filter((k) => {
      const v = (arMap[k] ?? '').trim();
      if (!v || /[\u0600-\u06FF]/.test(v) || allowed.test(v) || !/[A-Za-z]{3,}/.test(v))
        return false;
      return true;
    });
    expect(english).toEqual([]);
  });

  it('no vendor name-dropping in strategy copy', () => {
    const hits = Object.entries({ ...enMap, ...arMap })
      .filter(([k, v]) => k.startsWith('strategy.') && /jasper/i.test(v))
      .map(([k]) => k);
    expect(hits).toEqual([]);
  });
});
