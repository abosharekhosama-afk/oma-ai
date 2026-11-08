import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('notifications Planable-style UI', () => {
  it('renders content image and metadata inside notification previews', () => {
    const source = read('apps/web/src/components/shell/notifications-bell.tsx');
    const api = read('apps/web/src/lib/notifications-api.ts');
    const controller = read('apps/api/src/notifications/notifications.controller.ts');
    expect(source).toContain('oma-notification-card__preview-image');
    expect(source).toContain('<MediaSurface');
    expect(source).toContain('mime={preview.mime}');
    expect(api).toContain('mime?:');
    expect(controller).toContain('contentType: true');
    expect(source).toContain('contentPreview');
    expect(api).toContain('contentPreview?:');
    expect(controller).toContain('previewAssetId');
  });

  it('provides structured notification panel and media-card styling', () => {
    const css = read('apps/web/src/styles/shell.css');
    expect(css).toContain('Planable-style notification experience');
    expect(css).toContain('.oma-notification-card__preview-copy');
    expect(css).toContain('.oma-notification-card__channel');
    expect(css).toContain('.oma-notifications-panel__tabs');
  });

  it('maps Planable tabs to real listening and inbox notification types', () => {
    const source = read('apps/web/src/components/shell/notifications-bell.tsx');
    expect(source).toContain("listening: ['listening.alert_fired']");
    expect(source).toContain("inbox: ['inbox.message']");
    expect(source).toContain("if (tab === 'social_inbox') return ['inbox', 'publishing']");
    expect(source).toContain("return ['listening']");
    expect(source).not.toContain("if (tab === 'social_inbox') return ['publishing']");
    const ingest = read('apps/worker/src/inbox/ingest-conversation.ts');
    expect(ingest).toContain("type: 'inbox.message'");
  });
});
