import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

describe('ports boundary', () => {
  it('port files do not import concrete vendors', () => {
    const files = [
      'ai-provider.port.ts',
      'object-storage.port.ts',
      'workdrive.port.ts',
      'website-connector.port.ts',
      'paid-media-connector.port.ts',
      'mail-provider.port.ts',
      'retention-policy.port.ts',
    ];
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(src).not.toMatch(
        /openai|anthropic|aws-sdk|@aws-sdk|googleapis|meta-sdk|sendgrid|mailgun/i,
      );
    }
  });
});
