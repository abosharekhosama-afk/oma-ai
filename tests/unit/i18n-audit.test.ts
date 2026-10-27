import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * audit41 i18n guard:
 *  - EN/AR catalogs have identical keys and non-empty values
 *  - every t('literal') key used in the web app exists in both catalogs
 *  - Arabic is actually translated (AR !== EN) except for an explicit allowlist
 *  - user-visible copy carries no placeholders, raw error codes, permission ids or "demo" wording
 *  - audited surfaces have no hardcoded English JSX text / aria-label / placeholder / title
 */
const ROOT = join(__dirname, '..', '..');
const en = JSON.parse(readFileSync(join(ROOT, 'packages/i18n/messages/en.json'), 'utf8')) as Record<string, string>;
const ar = JSON.parse(readFileSync(join(ROOT, 'packages/i18n/messages/ar.json'), 'utf8')) as Record<string, string>;
const WEB = join(ROOT, 'apps/web/src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|ts)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}
const webFiles = walk(WEB);
const sources = new Map(webFiles.map((f) => [f, readFileSync(f, 'utf8')]));

function usedKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  const re = /\bt\(\s*'([a-zA-Z][\w]*(?:\.[\w]+)+)'/g;
  for (const [f, s] of sources) {
    for (const m of s.matchAll(re)) keys.set(m[1]!, relative(ROOT, f));
  }
  return keys;
}

/** Values legitimately identical in both languages (formats, brand names). */
const SAME_ALLOW = new Set(['content.hhmm']);

describe('i18n audit (EN/AR)', () => {
  it('catalogs have identical keys and no empty values', () => {
    const onlyEn = Object.keys(en).filter((k) => !(k in ar));
    const onlyAr = Object.keys(ar).filter((k) => !(k in en));
    expect(onlyEn).toEqual([]);
    expect(onlyAr).toEqual([]);
    const empty = Object.keys(en).filter((k) => !String(en[k]).trim() || !String(ar[k]).trim());
    expect(empty).toEqual([]);
  });

  it('every t() key used in the web app exists in EN and AR (no raw keys on screen)', () => {
    const missing = [...usedKeys()].filter(([k]) => !(k in en) || !(k in ar)).map(([k, f]) => `${k} (${f})`);
    expect(missing).toEqual([]);
  });

  it('Arabic values are translated (not copied English)', () => {
    const same = Object.keys(en).filter((k) => en[k] === ar[k] && !SAME_ALLOW.has(k));
    expect(same).toEqual([]);
    const latinOnlyAr = Object.keys(ar).filter(
      (k) => !SAME_ALLOW.has(k) && /[A-Za-z]{4,}/.test(ar[k]!) && !/[\u0600-\u06FF]/.test(ar[k]!),
    );
    expect(latinOnlyAr).toEqual([]);
  });

  it('used copy has no placeholders, raw codes, permission ids or demo wording', () => {
    const bad: string[] = [];
    const re =
      /\b(lorem|ipsum|TODO|FIXME|TBD)\b|\b[A-Z]{3,}_[A-Z_]{2,}\b|\b(tenant|brand|content)\.(manage|read|write)\b|Active tenant required|\bdemo\b|\bmock\b/i;
    for (const [k] of usedKeys()) {
      for (const v of [en[k], ar[k]]) if (v && re.test(v)) bad.push(`${k}: ${v}`);
    }
    // error/permission copy is always checked, used or not
    for (const k of Object.keys(en).filter((k) => /^(errors?|team\.perm|members\.role)\./.test(k))) {
      if (re.test(en[k]!) || re.test(ar[k]!)) bad.push(`${k}: ${en[k]}`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  const AUDITED = [
    'app/(app)/app/team/team-client.tsx',
    'components/settings/settings-panel.tsx',
    'app/(app)/app/select-company/planable-dashboard.tsx',
    'app/(app)/app/notifications/notifications-client.tsx',
    'app/(app)/app/home-client.tsx',
    'app/(auth)/login/page.tsx',
    'app/(auth)/register/page.tsx',
    'components/shell/workspace-settings-panel.tsx',
    'components/shell/notifications-bell.tsx',
    'components/shell/user-menu.tsx',
    'components/shell/shell-popover.tsx',
  ];

  it('audited surfaces have no hardcoded English UI strings', () => {
    const hits: string[] = [];
    for (const rel of AUDITED) {
      const s = readFileSync(join(WEB, rel), 'utf8');
      s.split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*|import )/.test(line)) return;
        const jsxText = />\s*([A-Z][a-z]+(?:[ ,'’-]+[a-zA-Z]+)+[.!?…]?)\s*</.exec(line);
        const attr = /\b(aria-label|placeholder|title|alt)="([A-Za-z][^"]*[a-z][^"]*)"/.exec(line);
        // emails/URLs are format hints, not copy
        if (attr && /^[\w.+-]*@[\w.-]+$|^https?:\/\/$/.test(attr[2]!)) attr.length = 0;
        const toast = /\b(toast\.push|setError|setMsg|setCreateError|confirm)\(\s*'([A-Z][^']*[a-z][^']*)'/.exec(line);
        const fallback = /err\.message\s*:\s*'([A-Z][^']+)'/.exec(line);
        for (const m of [jsxText, attr, toast, fallback]) if (m && m.length) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('API errors are mapped to localized friendly copy (never raw server text)', () => {
    const api = readFileSync(join(WEB, 'lib/api.ts'), 'utf8');
    expect(api).toContain('friendlyApiMessage');
    expect(api).not.toMatch(/new Error\(data\?\.error\?\.message/);
    for (const k of ['errors.permission_denied', 'errors.tenant_required', 'error.schedule_blocked', 'errors.network']) {
      expect(en[k], k).toBeTruthy();
      expect(ar[k], k).toMatch(/[\u0600-\u06FF]/);
    }
  });
});
