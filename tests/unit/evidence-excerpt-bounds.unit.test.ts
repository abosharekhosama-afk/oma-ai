import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('evidence excerpt bounds unit', () => {
  it('schema stores excerpt text only without blob columns', () => {
    const schema = readFileSync(join(process.cwd(), 'packages/db/prisma/schema.prisma'), 'utf8');
    expect(schema).toContain('excerptText      String');
    expect(schema).not.toMatch(/fullHtml|snapshotBlob|htmlSnapshot/i);
    expect(schema).not.toContain('bytea');
  });

  it('excerpt bounded by BRAND_MAX_BYTES env default in extraction', () => {
    const extraction = readFileSync(
      join(process.cwd(), 'apps/worker/src/brand/extraction.service.ts'),
      'utf8',
    );
    expect(extraction).toContain('maxBytes');
    expect(extraction).toContain('BRAND_MAX_BYTES');
  });
});
