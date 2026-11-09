import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Ant Design A2 migration inventory', () => {
  it('runs the scanner and reports remaining MIGRATE findings', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/ui/ant-migration-inventory.mjs', '--check'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as { findings: number; migrate: number };
    expect(report.findings).toBeGreaterThan(0);
    expect(typeof report.migrate).toBe('number');
  });
});
