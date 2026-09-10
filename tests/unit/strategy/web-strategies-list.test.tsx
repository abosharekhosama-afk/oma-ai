import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('web strategies list', () => {
  it('exposes create control testid on strategies list page', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'apps/web/src/app/(app)/app/brands/[brandId]/strategies/page.tsx'),
      'utf8',
    );
    expect(src).toContain('strategy-create');
  });
});
