import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Planable media library side panel', () => {
  it('renders a right-side library with search, folders, filters, upload, and create folder', () => {
    const picker = read('apps/web/src/components/content/media-picker.tsx');
    expect(picker).toContain("variant = 'drawer'");
    expect(picker).toContain('oma-ml--panel');
    expect(picker).toContain('oma-ml--drawer');
    expect(picker).toContain('media-search');
    expect(picker).toContain('media.searchAssets');
    expect(picker).toContain('media-filters');
    expect(picker).toContain('media-create-folder');
    expect(picker).toContain('media.brandAssets');
    expect(picker).toContain('media.allAssets');
    expect(picker).toContain('media-all-assets');
    expect(picker).toContain("openFolder('all')");
    expect(picker).toContain('media-canva-banner');
    expect(picker).toContain('mediaApi.createFolder');
    expect(picker).toContain("scope === 'brand'");
    expect(picker).not.toContain('<Modal');
    expect(picker).not.toContain('<Tabs');
  });

  it('opens the workspace library as a split side panel from the content header', () => {
    const client = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    expect(client).toContain('oma-plx-ml-split');
    expect(client).toContain('variant="panel"');
    expect(client).toContain('setMediaLibraryOpen((open) => !open)');
    expect(client).toContain("undefined, 'organization'");
    expect(client).toContain("undefined, 'brand'");
  });

  it('styles the Planable library chrome, folder chips, and 4-column grid', () => {
    const css = read('apps/web/src/styles/inbox-listening.css');
    expect(css).toContain('.oma-ml-grid');
    expect(css).toContain('repeat(4, minmax(0, 1fr))');
    expect(css).toContain('.oma-ml-canva');
    expect(css).toContain('.oma-ml-folder');
    expect(css).toContain('.oma-ml-source');
    expect(css).toContain('.oma-ml-used');
    expect(css).toContain('.oma-ml-play');
    expect(css).toContain('.oma-plx-ml-split');
  });

  it('keeps WorkDrive list cache warm and supports folder-targeted uploads', () => {
    const api = read('apps/web/src/lib/workdrive-api.ts');
    expect(api).toContain('browseCache');
    expect(api).toContain('createFolder');
    expect(api).toContain('folder_id');
    expect(api).not.toMatch(
      /list: \(brandId: string, kind\?: MediaKind\) => \{\s*invalidateApiCache/,
    );
  });

  it('offers an OMA / WorkDrive source toggle when both stores exist and hides the connect empty state for internal storage', () => {
    const picker = read('apps/web/src/components/content/media-picker.tsx');
    const api = read('apps/web/src/lib/workdrive-api.ts');
    const en = JSON.parse(read('packages/i18n/messages/en.json')) as Record<string, string>;
    const ar = JSON.parse(read('packages/i18n/messages/ar.json')) as Record<string, string>;
    expect(picker).toContain('data-testid="media-source-toggle"');
    expect(picker).toContain('data-testid="media-source-oma"');
    expect(picker).toContain('data-testid="media-source-workdrive"');
    expect(picker).toContain("t('media.sourceOma')");
    expect(picker).toContain("t('media.sourceWorkDrive')");
    expect(picker).toContain('internal_available');
    expect(picker).toContain('byos_connected');
    expect(picker).toContain('showSourceToggle');
    expect(picker).toContain('storageSource');
    expect(api).toContain("qs.set('source', source)");
    expect(api).toContain('source?:');
    expect(en['media.sourceOma']).toBe('OMA storage');
    expect(en['media.sourceWorkDrive']).toBe('My WorkDrive');
    expect(ar['media.sourceOma']).toBe('تخزين OMA');
    expect(ar['media.sourceWorkDrive']).toBe('WorkDrive الخاص بي');
    expect(en['media.sourceLabel']).toBeTruthy();
    expect(ar['media.sourceLabel']).toBeTruthy();
  });
});
