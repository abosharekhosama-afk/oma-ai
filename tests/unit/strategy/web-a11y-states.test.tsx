import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('web a11y states', () => {
  it('uses role=alert on conflict banner and aria-label on status badge', () => {
    const conflict = readFileSync(
      path.join(process.cwd(), 'apps/web/src/components/strategy/conflict-banner.tsx'),
      'utf8',
    );
    const badge = readFileSync(
      path.join(process.cwd(), 'apps/web/src/components/strategy/status-badge.tsx'),
      'utf8',
    );
    expect(conflict).toContain('role="alert"');
    expect(badge).toContain('aria-label');
  });
});
