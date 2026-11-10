import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../packages/i18n/messages/en.json';
import ar from '../../packages/i18n/messages/ar.json';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('standalone status pages', () => {
  it('route-level 404 and 500 pages use the standalone ErrorState card', () => {
    const files = [
      'apps/web/src/app/not-found.tsx',
      'apps/web/src/app/error.tsx',
      'apps/web/src/app/(app)/app/not-found.tsx',
      'apps/web/src/app/(app)/app/error.tsx',
    ];
    for (const file of files) {
      const src = read(file);
      expect(src, file).toMatch(/ErrorState/);
      expect(src, file).not.toMatch(/compact\s*=\s*\{?true/);
    }
    const errorState = read('apps/web/src/components/ui/error-state.tsx');
    expect(errorState).toMatch(/StatusPage/);
    expect(errorState).toMatch(/isStandalone = standalone \?\? !compact/);
    expect(errorState).toMatch(/createPortal|StatusPage/);
    const statusPage = read('apps/web/src/components/ui/status-page.tsx');
    expect(statusPage).toMatch(/createPortal/);
    expect(statusPage).toMatch(/data-testid="status-page"/);
    expect(statusPage).toMatch(/PlxLogo/);
    const css = read('apps/web/src/styles/states.css');
    expect(css).toMatch(/\.oma-status-page\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.oma-status-page\s*\{[^}]*inset:\s*0/);
    expect(css).toMatch(/body:has\(\.oma-status-page\)[\s\S]*\.oma-rail/);
    expect(read('apps/web/src/components/shell/permission-denied.tsx')).toMatch(/kind="forbidden"/);
    expect(read('apps/web/src/components/shell/session-invalid.tsx')).toMatch(
      /testId="session-invalid"/,
    );
    expect(read('apps/web/src/app/global-error.tsx')).toMatch(/data-testid="status-page"/);
    expect(read('apps/web/src/app/(app)/app/home-client.tsx')).toMatch(/PermissionDenied/);
    expect(read('apps/web/src/app/(app)/app/[...missing]/page.tsx')).toMatch(/notFound\(\)/);
  });
});

describe('single connection indicator', () => {
  it('renders OfflineBanner only once, under the header', () => {
    const files = walk(join(root, 'apps/web/src'));
    const mounts = files.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return /<(OfflineBanner|NetworkConnectivityBanner)\b/.test(src);
    });
    expect(mounts.map((f) => f.slice(root.length + 1))).toEqual([
      'apps/web/src/components/shell/shell-chrome.tsx',
    ]);
    const shell = read('apps/web/src/components/shell/shell-chrome.tsx');
    expect(shell).toMatch(/<OfflineBanner \/>\s*\n\s*<main id="main"/);
    expect((shell.match(/<OfflineBanner/g) ?? []).length).toBe(1);
  });

  it('keeps one online/offline listener and uses on-brand warning and success tokens', () => {
    const files = walk(join(root, 'apps/web/src'));
    const offlineListeners = files.filter((f) =>
      readFileSync(f, 'utf8').includes("addEventListener('offline'"),
    );
    expect(offlineListeners.map((f) => f.slice(root.length + 1))).toEqual([
      'apps/web/src/components/ui/offline-banner.tsx',
    ]);
    const banner = read('apps/web/src/components/ui/offline-banner.tsx');
    expect(banner).toMatch(/errors\.onlineBanner/);
    expect(banner).toMatch(/oma-offline-banner--online/);
    const css = read('apps/web/src/styles/states.css');
    expect(css).toMatch(
      /\.oma-offline-banner\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--status-warning\)/,
    );
    expect(css).toMatch(
      /\.oma-offline-banner--online\s*\{[^}]*background:\s*var\(--oma-badge-success-bg\)/,
    );
    expect(css).toMatch(/\.oma-offline-banner__dot\s*\{[^}]*background:\s*var\(--status-warning\)/);
    expect(css).toMatch(
      /\.oma-offline-banner--online \.oma-offline-banner__dot\s*\{[^}]*background:\s*var\(--status-success\)/,
    );
    expect(css).not.toMatch(/\.oma-offline-banner\s*\{[^}]*--oma-badge-warning-bg/);
    const tokens = read('packages/ui/src/tokens.css');
    expect(tokens).toMatch(/--status-warning:\s*#b7791f/);
    expect(tokens).toMatch(/--status-success:\s*#21875a/);
    expect(tokens).toMatch(/--oma-badge-success-bg:\s*#e8f6ef/);
    expect(tokens).toMatch(/--oma-primary:\s*#1677ff/);
    expect((en as Record<string, string>)['errors.onlineBanner']).toBeTruthy();
    expect((ar as Record<string, string>)['errors.onlineBanner']).toBeTruthy();
  });
});
