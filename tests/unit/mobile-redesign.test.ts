import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MOBILE_REDESIGN_ATTR,
  MOBILE_REDESIGN_VALUE,
  resolveMobileRedesignWorkspace,
} from '../../apps/web/src/lib/mobile-redesign-v1';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('mobile redesign v1', () => {
  it('loads mobile-redesign-v1.css after legacy mobile layers', () => {
    const globals = read('apps/web/src/app/globals.css');
    const redesign = globals.indexOf('mobile-redesign-v1.css');
    const legacy = globals.indexOf('mobile-ux-pro-max-reset.css');
    expect(redesign).toBeGreaterThan(-1);
    expect(legacy).toBeGreaterThan(-1);
    expect(redesign).toBeGreaterThan(legacy);
  });

  it('loads requests mobile overrides after redesign v1', () => {
    const globals = read('apps/web/src/app/globals.css');
    const req = globals.indexOf('mobile-redesign-requests.css');
    const v1 = globals.indexOf('mobile-redesign-v1.css');
    expect(req).toBeGreaterThan(v1);
  });

  it('documents the redesign gate attribute', () => {
    const css = read('apps/web/src/styles/mobile-redesign-v1.css');
    expect(css).toContain(`${MOBILE_REDESIGN_ATTR}='${MOBILE_REDESIGN_VALUE}'`);
    expect(css).not.toContain('zoom:');
  });

  it('maps primary workspace routes', () => {
    expect(resolveMobileRedesignWorkspace('/app')).toBe('home');
    expect(resolveMobileRedesignWorkspace('/app/content')).toBe('content');
    expect(resolveMobileRedesignWorkspace('/app/requests/abc')).toBe('requests');
    expect(resolveMobileRedesignWorkspace('/app/tasks')).toBe('tasks');
    expect(resolveMobileRedesignWorkspace('/app/deliverables/x')).toBe('deliverables');
    expect(resolveMobileRedesignWorkspace('/app/brands')).toBeNull();
  });

  it('wires shell workspace data attribute', () => {
    const shell = read('apps/web/src/components/shell/shell-chrome.tsx');
    expect(shell).toContain('data-mobile-redesign-ws');
    expect(shell).toContain('applyMobileRedesignFlag');
  });

  it('bootstraps redesign flag before interactive (no flash / no missing CSS)', () => {
    const layout = read('apps/web/src/app/layout.tsx');
    expect(layout).toContain('oma-mobile-redesign-bootstrap');
    expect(layout).toContain('MOBILE_REDESIGN_ATTR');
    expect(layout).toContain('beforeInteractive');
  });
});
