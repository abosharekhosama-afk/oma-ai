import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('collision-aware floating menus', () => {
  it('portals the platform picker, actions menu, and similar selectors', () => {
    const overlay = read('apps/web/src/components/ui/floating-overlay.tsx');
    expect(overlay).toContain('createPortal');
    expect(overlay).toContain('oma-floating-overlay');
    expect(overlay).toContain('zIndex');
    expect(overlay).toContain('maxHeight');

    const source = read('apps/web/src/app/(app)/app/listening/listening-source-menu.tsx');
    expect(source).toContain('<FloatingOverlay');
    expect(source).toContain('oma-plx-listening-source__menu');

    const actions = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    expect(actions).toContain('oma-plan-post__more-menu');
    expect(actions).toContain('<FloatingOverlay');
    expect(actions).toContain('zIndex: 12000');

    const inbox = read('apps/web/src/app/(app)/app/inbox/inbox-status-dropdown.tsx');
    expect(inbox).toContain('<FloatingOverlay');
    expect(inbox).toContain('oma-plx-inbox-open-card__panel');

    const thread = read('apps/web/src/app/(app)/app/inbox/inbox-thread-menu.tsx');
    expect(thread).toContain('<FloatingOverlay');
    expect(thread).toContain('oma-plx-inbox-thread-menu__drop');
  });
});
