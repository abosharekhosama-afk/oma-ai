#!/usr/bin/env node
/**
 * Read-only Planable component probe over CDP 127.0.0.1:9333.
 * No mutations. Captures computed styles for dialogs/forms/nav/motion.
 */
/* eslint-disable no-undef -- browser APIs run inside Playwright evaluate() */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CDP = 'http://127.0.0.1:9333';
const OUT = join(process.cwd(), 'artifacts/planable-component-parity-004');
const REF = join(process.cwd(), '.reference/005-planable-ui-ux/ours/component-parity-rebuild');

const STYLE_KEYS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'color',
  'backgroundColor',
  'borderTopWidth',
  'borderTopStyle',
  'borderTopColor',
  'borderRadius',
  'boxShadow',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'gap',
  'height',
  'width',
  'minHeight',
  'maxWidth',
  'opacity',
  'transition',
  'transform',
];

async function measure(page, selector, label) {
  const loc = page.locator(selector).first();
  if ((await loc.count()) === 0) return { label, selector, found: false };
  const box = await loc.boundingBox().catch(() => null);
  const styles = await loc.evaluate((el, keys) => {
    const cs = getComputedStyle(el);
    const o = {};
    for (const k of keys) o[k] = cs[k];
    o.tag = el.tagName.toLowerCase();
    o.role = el.getAttribute('role');
    o.className = (el.className || '').toString().slice(0, 120);
    return o;
  }, STYLE_KEYS);
  return { label, selector, found: true, box, styles };
}

async function probeRoute(page, path, shotsDir) {
  const url = path.startsWith('http') ? path : `https://app.planable.io${path}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  const title = await page.title();
  const urlNow = page.url();
  if (/login|signin|auth/i.test(urlNow)) {
    return { path, url: urlNow, authRequired: true };
  }

  const probes = [];
  const candidates = [
    ['rail', '[data-cy*="sidebar"], nav, [class*="Sidebar"], aside'],
    ['nav_row', 'a[href*="campaign"], [data-cy*="campaign"], [role="navigation"] a'],
    ['primary_btn', 'button[data-cy*="review"], button.ant-btn-primary, button[class*="primary"]'],
    ['secondary_btn', 'button.ant-btn-default, button[class*="secondary"]'],
    ['input', 'input:not([type=hidden]):not([type=checkbox]):not([type=radio])'],
    ['select', 'select, .ant-select-selector, [role="combobox"]'],
    ['textarea', 'textarea'],
    ['search', 'input[type=search], input[placeholder*="Search" i], [data-cy*="search"] input'],
    ['chip', '[class*="tag"], [class*="Chip"], .ant-tag'],
    ['card', '[class*="Card"], [data-cy*="card"], .ant-card'],
    ['tab', '[role="tab"], .ant-tabs-tab'],
    ['menu_item', '[role="menuitem"]'],
    ['dialog', '[role="dialog"]'],
    ['overlay', '.ant-modal-mask, [class*="Overlay"], [class*="backdrop"]'],
    ['drawer', '.ant-drawer, [class*="Drawer"], [role="dialog"][class*="drawer"]'],
    ['avatar', '[class*="avatar"], .ant-avatar'],
    ['breadcrumb', 'nav[aria-label*="breadcrumb" i], [data-cy*="breadcrumb"]'],
  ];

  for (const [label, selector] of candidates) {
    probes.push(await measure(page, selector, label));
  }

  // soft open menus / dialogs without committing (Escape after)
  const softClicks = [
    {
      name: 'workspace_menu',
      sel: '[data-cy="workspace-menu-button"], button:has-text("Workspace")',
    },
    {
      name: 'view_switcher',
      sel: '[data-cy*="view"], button:has-text("Calendar"), button:has-text("Feed")',
    },
    {
      name: 'createish',
      sel: '[data-cy*="create"], button:has-text("New"), button:has-text("Compose")',
    },
  ];
  const soft = [];
  for (const c of softClicks) {
    const loc = page.locator(c.sel).first();
    if ((await loc.count()) === 0) {
      soft.push({ name: c.name, opened: false });
      continue;
    }
    try {
      await loc.click({ timeout: 3000, trial: false });
      await page.waitForTimeout(600);
      const dialog = await measure(
        page,
        '[role="dialog"], [role="menu"], [role="listbox"]',
        `${c.name}_surface`,
      );
      soft.push({ name: c.name, opened: true, surface: dialog });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    } catch (e) {
      soft.push({ name: c.name, opened: false, error: String(e).slice(0, 120) });
      await page.keyboard.press('Escape').catch(() => {});
    }
  }

  const shot = join(shotsDir, `${path.replace(/\W+/g, '_').replace(/^_+|_+$/g, '') || 'root'}.png`);
  await page.screenshot({ path: shot, fullPage: false });

  const root = await page.evaluate((keys) => {
    const html = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    const o = { html: {}, body: {} };
    for (const k of keys) {
      o.html[k] = html[k];
      o.body[k] = body[k];
    }
    o.htmlFontSize = html.fontSize;
    return o;
  }, STYLE_KEYS);

  return { path, url: urlNow, title, authRequired: false, root, probes, soft, screenshot: shot };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(REF, { recursive: true });
  mkdirSync(join(OUT, 'screenshots'), { recursive: true });
  mkdirSync(join(REF, 'screenshots'), { recursive: true });

  const browser = await chromium.connectOverCDP(CDP);
  const context = browser.contexts()[0];
  if (!context) throw new Error('CDP_READY_NO_CONTEXT');
  const page = context.pages()[0] || (await context.newPage());
  await page.setViewportSize({ width: 1440, height: 900 });

  const routes = ['/dashboard', '/campaigns', '/calendar'];
  const results = [];
  for (const r of routes) {
    try {
      const row = await probeRoute(page, r, join(OUT, 'screenshots'));
      results.push(row);
      console.log('ROUTE', r, row.authRequired ? 'AUTH' : 'OK', row.url);
      if (row.authRequired) break;
    } catch (e) {
      results.push({ path: r, error: String(e) });
      console.log('ROUTE_ERR', r, e.message);
    }
  }

  // responsive shells (read-only screenshots)
  for (const [w, h, name] of [
    [1024, 768, 'tablet'],
    [390, 844, 'mobile'],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('https://app.planable.io/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const shot = join(OUT, 'screenshots', `dashboard_${name}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    results.push({ path: `/dashboard@${name}`, screenshot: shot, viewport: { w, h } });
  }

  const summary = {
    capturedAt: new Date().toISOString(),
    access: 'CDP_READY_AUTHENTICATED',
    profile: 'OMA-References-Chrome',
    cdp: CDP,
    routes: results,
  };

  writeFileSync(join(OUT, 'component-probe.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(REF, 'component-probe.json'), JSON.stringify(summary, null, 2));

  // compact delta seeds for known OMA tokens
  const foundInputs = results
    .flatMap((r) => r.probes || [])
    .filter((p) => p.found && p.label === 'input');
  const foundPrimary = results
    .flatMap((r) => r.probes || [])
    .filter((p) => p.found && p.label === 'primary_btn');
  const foundDialog = results
    .flatMap((r) => [...(r.probes || []), ...(r.soft || []).map((s) => s.surface)].filter(Boolean))
    .filter((p) => p?.found && /dialog|menu|_surface/.test(p.label));

  const compact = {
    inputSample: foundInputs[0] || null,
    primaryBtnSample: foundPrimary[0] || null,
    overlaySample: foundDialog[0] || null,
    bodyFont: results.find((r) => r.root)?.root?.body?.fontFamily,
    bodySize: results.find((r) => r.root)?.root?.body?.fontSize,
    canvas: results.find((r) => r.root)?.root?.body?.backgroundColor,
  };
  writeFileSync(join(OUT, 'component-probe-compact.json'), JSON.stringify(compact, null, 2));
  writeFileSync(join(REF, 'component-probe-compact.json'), JSON.stringify(compact, null, 2));

  console.log('WROTE', join(OUT, 'component-probe.json'));
  console.log('COMPACT', JSON.stringify(compact, null, 2));
  // leave browser open
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
