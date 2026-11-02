import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('team notifications Planable settings', () => {
  it('uses switch rows with auto-save instead of donut placeholders', () => {
    const src = readFileSync(
      resolve('apps/web/src/app/(app)/app/team/team-client.tsx'),
      'utf8',
    );
    expect(src).toContain('oma-notif-settings');
    expect(src).toContain('oma-switch');
    expect(src).toContain('settings.notifications.channel_inapp');
    expect(src).toContain('updatePreferences({ notifications: next.notifications })');
    expect(src).not.toContain('NotifDonut');
    expect(src).not.toContain('oma-notif-donut');
  });
});
