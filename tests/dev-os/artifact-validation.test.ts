import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { validateArtifact } from '../../scripts/reference/validate-reference-artifacts.mjs';

const REPO_ROOT = join(__dirname, '../..');
const fixture = (kind: string, name: string) =>
  join(REPO_ROOT, '.reference/_fixtures', kind, `${name}.json`);

describe('reference artifact validation', () => {
  it('accepts valid navigation, surface, and parity artifacts', () => {
    for (const name of ['navigation-map', 'surface-inventory', 'parity-matrix']) {
      const result = validateArtifact(fixture('valid', name));
      expect(result.errors, `${name} errors`).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });

  it('rejects a capture that recorded nothing', () => {
    const result = validateArtifact(fixture('empty', 'surface-inventory'));
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/at least one entry/);
  });

  it('rejects an auth-blocked capture as evidence', () => {
    const result = validateArtifact(fixture('blocked', 'surface-inventory'));
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/AUTH_REQUIRED.*not a successful capture/);
  });

  it('survives the integrity guard: fixtures live under an approved root', async () => {
    const { isApprovedWritePath } =
      await import('../../scripts/reference/lib/source-integrity.mjs');
    // Fixtures are committed inputs, so they are readable evidence but not
    // rewritable by an inspection run.
    expect(isApprovedWritePath('.reference/_fixtures/valid/surface-inventory.json')).toBe(false);
    expect(isApprovedWritePath('.reference/fixture-reference/coverage-summary.json')).toBe(true);
  });
});
