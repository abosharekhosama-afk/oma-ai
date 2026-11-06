import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pickCopy } from '../../apps/web/src/lib/demo/use-demo-api';
import { localContentProposal } from '../../apps/web/src/lib/content-ai';
import { errorKindOf } from '../../apps/web/src/components/ui/error-state';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('content error + feed hover + AI proposals', () => {
  it('does not crash pickCopy on missing locale copy', () => {
    expect(pickCopy(undefined, 'en')).toBe('');
    expect(pickCopy(null, 'ar')).toBe('');
    expect(pickCopy('plain', 'en')).toBe('plain');
    expect(pickCopy({ en: 'Hello', ar: 'مرحبا' }, 'ar')).toBe('مرحبا');
    expect(pickCopy({ en: 'Hello' }, 'ar')).toBe('Hello');
  });

  it('classifies real HTTP failures for the unified error card', () => {
    expect(errorKindOf({ status: 500 })).toBe('server');
    expect(errorKindOf({ status: 503 })).toBe('server');
    expect(errorKindOf({ status: 0 })).toBe('network');
    expect(errorKindOf({ status: 403 })).toBe('forbidden');
    expect(errorKindOf({ status: 404 })).toBe('notFound');
  });

  it('builds a reviewable caption and alt proposal without a live provider', () => {
    const caption = localContentProposal({
      kind: 'caption',
      locale: 'en',
      brandName: 'Jusco',
      channel: 'Instagram',
      caption: 'Summer citrus is here',
    });
    expect(caption).toMatch(/Jusco/);
    expect(caption).toMatch(/Summer citrus/);
    const alt = localContentProposal({
      kind: 'alt',
      locale: 'en',
      brandName: 'Jusco',
      channel: 'Instagram',
      caption: 'Summer citrus is here',
    });
    expect(alt.toLowerCase()).toMatch(/jusco|visual|instagram/);
  });

  it('keeps Planable hover tools, alt AI, and unified plx error cards in source', () => {
    const preview = read('apps/web/src/components/content/post-preview.tsx');
    const errors = read('apps/web/src/components/ui/error-state.tsx');
    const css = read('apps/web/src/styles/inbox-listening.css');
    const client = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    expect(preview).toContain('feed-media-crop');
    expect(preview).toContain('feed-alt-text');
    expect(preview).toContain('Generate with AI');
    expect(preview).toContain('Add more from computer');
    expect(errors).toContain('oma-plx-error');
    expect(css).toContain('.oma-plx-error');
    expect(client).toContain('onGenerateAi');
    expect(client).toContain('removeFeedMedia');
    expect(client).toContain('proposeContentText');
  });
});
