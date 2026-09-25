import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Ant Design A2 migration inventory', () => {
  it('reports zero remaining MIGRATE findings', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/ui/ant-migration-inventory.mjs', '--check'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('"migrate": 0');
  });
});
