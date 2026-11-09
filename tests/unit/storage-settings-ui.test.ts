import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const en = JSON.parse(read('packages/i18n/messages/en.json')) as Record<string, string>;
const ar = JSON.parse(read('packages/i18n/messages/ar.json')) as Record<string, string>;

describe('storage settings UI', () => {
  it('adds mode cards, usage, and WorkDrive connect controls in workspace settings', () => {
    const panel = read('apps/web/src/components/settings/settings-panel.tsx');
    const ui = read('apps/web/src/components/settings/storage-settings.tsx');
    const wd = read('apps/web/src/components/settings/workdrive-settings.tsx');
    const api = read('apps/web/src/lib/workdrive-api.ts');
    expect(panel).toContain('StorageSettings');
    expect(panel).toContain("section === 'storage'");
    expect(ui).toContain('data-testid="storage-settings"');
    expect(ui).toContain('data-testid={`storage-mode-${mode}`}');
    expect(ui).toContain('OMA_INTERNAL');
    expect(ui).toContain('USER_WORKDRIVE');
    expect(ui).toContain('SYNC_BACKUP');
    expect(ui).toContain('data-testid="storage-usage-bar"');
    expect(ui).toContain('data-testid="storage-usage-byos"');
    expect(ui).toContain("t('storage.usage.byos')");
    expect(ui).toContain("t('storage.mode.sync.soon')");
    expect(ui).toContain("t('storage.explainer')");
    expect(ui).toContain('workDriveApi.setMode');
    expect(ui).toContain('<WorkDriveSettings');
    expect(wd).toContain('data-testid="workdrive-form"');
    expect(wd).toContain('data-testid="workdrive-test"');
    expect(wd).toContain('data-testid="workdrive-disconnect"');
    expect(wd).toContain('onChanged');
    expect(api).toContain("json('PATCH', { mode })");
    expect(api).toContain('/api/v1/workspace/storage');
  });

  it('softens mandatory WorkDrive copy when internal storage can accept uploads', () => {
    const picker = read('apps/web/src/components/content/media-picker.tsx');
    const logos = read('apps/web/src/components/brand/brand-settings-view.tsx');
    expect(picker).toContain('can_upload');
    expect(picker).toContain('storageReady');
    expect(picker).not.toMatch(/const connected = lib\?\.workdrive\.connected/);
    expect(logos).toContain("t('brandSettings.general.logoHintOma')");
    expect(logos).toContain('canUpload');
    expect(en['media.connectTitle']).toContain('Storage');
    expect(en['workdrive.notConnected']).toMatch(/OMA storage/);
    expect(en['errors.workdrive_not_connected']).toMatch(/OMA storage/);
    expect(en['storage.usage.byos']).toMatch(/0 GB on OMA/);
    const keys = [
      'storage.title',
      'storage.desc',
      'storage.explainer',
      'storage.mode.internal.title',
      'storage.mode.byos.title',
      'storage.mode.sync.title',
      'storage.mode.sync.soon',
      'storage.usage.byos',
      'storage.adminOnly',
      'brandSettings.general.logoHintOma',
    ];
    for (const key of keys) {
      expect(en[key]?.trim()).toBeTruthy();
      expect(ar[key]?.trim()).toBeTruthy();
      expect(ar[key]).not.toBe(en[key]);
    }
  });
});
