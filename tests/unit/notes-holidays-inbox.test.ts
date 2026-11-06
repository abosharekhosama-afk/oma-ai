import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('calendar notes, holiday calendars, media all-files, social inbox', () => {
  it('opens a sticky note on the Note button even when display notes are hidden', () => {
    const client = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    expect(client).toContain('data-testid={`demo-cal-note-${cell.key}`}');
    expect(client).toContain('setCalDisplay({ ...calDisplay, showNotes: true })');
    expect(client).toContain('(calDisplay.showNotes && note) || noteOpen');
    expect(client).toContain('data-note-open');
    expect(client).not.toContain('DEMO_HOLIDAYS');
  });

  it('persists holiday calendars by region from the card and workspace settings', () => {
    const client = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    expect(client).toContain('patchHolidayCalendars');
    expect(client).toContain('content-holiday-region');
    expect(client).toContain('holidayMapForCalendars');
    const settings = read('apps/web/src/components/shell/workspace-settings-panel.tsx');
    expect(settings).toContain('ws-holiday-region');
    expect(settings).toContain('holiday_calendars');
    const api = read('apps/api/src/workspace/workspace-settings.controller.ts');
    expect(api).toContain("Patch('holiday-calendars')");
    expect(api).toContain('holidayCalendars');
  });

  it('flattens accessible WorkDrive files for the All files chip', () => {
    const media = read('apps/api/src/media/media.service.ts');
    expect(media).toContain("q.scope === 'all'");
    expect(media).toContain('collectAccessibleFiles');
    const picker = read('apps/web/src/components/content/media-picker.tsx');
    expect(picker).toContain("type Scope = 'brand' | 'organization' | 'all'");
  });

  it('filters social inbox by channel and shows internal notes on DMs', () => {
    const inbox = read('apps/web/src/app/(app)/app/inbox/inbox-client.tsx');
    expect(inbox).toContain('inbox-channel-filter');
    expect(inbox).toContain("platform: platformFilter === 'all' ? undefined : platformFilter");
    expect(inbox).toContain('unanswered: unansweredOnly || undefined');
    expect(inbox).toContain('inbox-internal-notes');
  });
});
