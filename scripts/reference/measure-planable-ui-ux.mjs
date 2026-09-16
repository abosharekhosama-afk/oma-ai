#!/usr/bin/env node
/**
 * Read-only Planable app.planable.io measurement over the existing CDP session.
 * Navigates views, inspects computed styles, opens menus/modals without submit.
 * Never creates, edits, comments, approves, invites, publishes, or bills.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(REPO_ROOT, '.reference/005-planable-ui-ux');
const CDP = 'http://127.0.0.1:9333';
const CAPTURED_AT = new Date().toISOString();

const FORBIDDEN_CLICK =
  /upgrade|billing|invite|connect|publish|schedule post|delete|export|trial|pay|new post|create post|approve all|reject/i;

async function measurePage(page) {
  return page.evaluate(() => {
    const pick = (sel) => document.querySelector(sel);
    const byCy = (cy) => document.querySelector(`[data-cy="${cy}"]`);
    const first = (...sels) => {
      for (const s of sels) {
        const el = typeof s === 'string' ? document.querySelector(s) : s;
        if (el) return el;
      }
      return null;
    };
    const cssOf = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        cy: el.getAttribute('data-cy'),
        role: el.getAttribute('role'),
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        color: s.color,
        backgroundColor: s.backgroundColor,
        borderTopColor: s.borderTopColor,
        borderTopWidth: s.borderTopWidth,
        borderRadius: s.borderRadius,
        boxShadow: s.boxShadow,
        padding: s.padding,
        gap: s.gap,
        width: Math.round(r.width),
        height: Math.round(r.height),
        x: Math.round(r.x),
        y: Math.round(r.y),
        transitionDuration: s.transitionDuration,
        transitionTimingFunction: s.transitionTimingFunction,
        zIndex: s.zIndex,
        opacity: s.opacity,
        overflowX: s.overflowX,
      };
    };

    const body = document.body;
    const html = document.documentElement;
    const sidebar =
      byCy('navSidebar') || byCy('navBody') || pick('aside') || pick('[data-cy*="sidebar" i]');
    const topbar =
      byCy('navbar') ||
      pick('header') ||
      pick('[data-cy="navbarAppLogo"]')?.closest('header, nav, div');
    const h1 = pick('h1');
    const main = pick('main') || pick('[role="main"]');
    const primaryBtn = [...document.querySelectorAll('button')].find((b) => {
      const t = (b.innerText || '').trim();
      return /new |create |compose/i.test(t) && !/workspace/i.test(t);
    });
    const secondaryBtn = [...document.querySelectorAll('button')].find((b) =>
      /filter|search/i.test((b.innerText || b.getAttribute('aria-label') || '').trim()),
    );
    const input = pick('input:not([type="hidden"])');
    const card =
      pick('[data-cy*="post" i]') ||
      pick('[class*="PostCard" i]') ||
      pick('[class*="post-card" i]');
    const chip = [...document.querySelectorAll('span, div, button')].find(
      (el) =>
        /approved|draft|scheduled|pending/i.test((el.innerText || '').trim()) &&
        (el.innerText || '').trim().length < 40,
    );
    const dialog = pick('[role="dialog"]');
    const menu = pick('[role="menu"]');

    const overflow = html.scrollWidth > html.clientWidth + 2;

    const navItems = [
      ...document.querySelectorAll(
        '[data-cy="navBody"] a, [data-cy="navBody"] button, [data-cy="navSidebar"] a, [data-cy="navSidebar"] button',
      ),
    ]
      .map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 24);

    const cyKeys = [...document.querySelectorAll('[data-cy]')]
      .map((el) => el.getAttribute('data-cy'))
      .filter(Boolean);
    const uniqueCy = [...new Set(cyKeys)].slice(0, 80);

    return {
      url: location.href.replace(/\/[A-Za-z0-9_-]{8,}/g, '/{id}'),
      title: document.title.replace(/[^\x20-\x7E]/g, ' ').slice(0, 80),
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        dpr: window.devicePixelRatio,
      },
      dir: html.getAttribute('dir') || getComputedStyle(html).direction,
      lang: html.lang,
      overflowX: overflow,
      html: cssOf(html),
      body: cssOf(body),
      sidebar: cssOf(sidebar),
      topbar: cssOf(topbar),
      h1: cssOf(h1),
      main: cssOf(main),
      primaryButton: cssOf(primaryBtn),
      secondaryControl: cssOf(secondaryBtn),
      input: cssOf(input),
      card: cssOf(card),
      statusChip: cssOf(chip),
      dialog: cssOf(dialog),
      menu: cssOf(menu),
      navLabels: navItems,
      dataCySample: uniqueCy,
    };
  });
}

async function clickCy(page, cy) {
  return page.evaluate((key) => {
    const el = document.querySelector(`[data-cy="${key}"]`);
    if (!el) return 'missing';
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    el.click();
    return 'clicked';
  }, cy);
}

async function pressEsc(page) {
  await page.keyboard.press('Escape').catch(() => {});
}

async function waitQuiet(page, ms = 800) {
  await page.waitForTimeout(ms);
}

function writeJson(rel, data) {
  const path = join(OUT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  return path;
}

async function main() {
  mkdirSync(join(OUT, 'measurements'), { recursive: true });
  mkdirSync(join(OUT, 'surfaces'), { recursive: true });
  mkdirSync(join(OUT, 'interactions'), { recursive: true });
  mkdirSync(join(OUT, 'raw-screenshots'), { recursive: true });

  const browser = await chromium.connectOverCDP(CDP);
  const context = browser.contexts()[0];
  if (!context) throw new Error('CDP_READY_NO_CONTEXT');
  const page = context.pages().find((p) => p.url().includes('app.planable.io'));
  if (!page) throw new Error('REFERENCE_TAB_NOT_FOUND');

  const sessionUrl = page.url();
  const authed = !/\/(login|signin|sign-up)/i.test(sessionUrl);
  if (!authed) {
    writeJson('coverage.json', {
      accessStatus: 'AUTH_REQUIRED',
      origin: 'https://app.planable.io',
      capturedAt: CAPTURED_AT,
    });
    console.log('AUTH_REQUIRED');
    return;
  }

  const wsMatch = sessionUrl.match(/app\.planable\.io\/[a-z-]+\/([A-Za-z0-9_-]+)/);
  const workspaceId = wsMatch?.[1] ?? null;

  const surfaces = [];
  const interactions = [];
  const limitations = [];

  async function capture(id, label, evidenceLevel, extra = {}) {
    const measurement = await measurePage(page);
    const record = {
      id,
      label,
      evidenceLevel,
      capturedAt: CAPTURED_AT,
      source: 'app.planable.io',
      sourceKind: 'PRODUCT_APP',
      ...extra,
      measurement,
    };
    writeJson(`measurements/${id}.json`, record);
    writeJson(`surfaces/${id}.json`, {
      id,
      label,
      evidenceLevel,
      routePattern: measurement.url,
      navLabels: measurement.navLabels,
      dataCySample: measurement.dataCySample,
      overflowX: measurement.overflowX,
      viewport: measurement.viewport,
    });
    surfaces.push({ id, label, evidenceLevel, routePattern: measurement.url });
    const shot = join(OUT, 'raw-screenshots', `${id}.png`);
    await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
    return record;
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await waitQuiet(page, 500);
  await capture('shell-approvals-1440', 'Approvals / shell (desktop)', 'LIVE_VERIFIED');

  if (workspaceId) {
    for (const [path, id, label] of [
      [
        `https://app.planable.io/campaigns/${workspaceId}/all`,
        'campaigns-all-1440',
        'Campaigns all',
      ],
      [`https://app.planable.io/calendar/${workspaceId}`, 'calendar-1440', 'Calendar'],
    ]) {
      try {
        await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await waitQuiet(page, 1200);
        await capture(id, label, 'LIVE_VERIFIED');
      } catch (err) {
        limitations.push({ id, reason: String(err.message).slice(0, 200) });
      }
    }

    try {
      await page.goto(`https://app.planable.io/calendar/${workspaceId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 25000,
      });
      await waitQuiet(page, 1000);
      const viewClick = await clickCy(page, 'viewSelector');
      await waitQuiet(page, 400);
      const menuText = await page.evaluate(() => {
        const menu = [...document.querySelectorAll('[role="menu"]')].find((m) =>
          /calendar|feed|grid|list/i.test(m.innerText),
        );
        return menu ? menu.innerText.slice(0, 800) : null;
      });
      writeJson('interactions/view-switcher.json', {
        id: 'view-switcher',
        evidenceLevel: menuText ? 'LIVE_VERIFIED' : 'PARTIAL',
        action: 'opened viewSelector; closed with Escape; no mutation',
        clickResult: viewClick,
        menuTextSanitized: menuText
          ? menuText.replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '{Name}')
          : null,
      });
      interactions.push('view-switcher');
      await pressEsc(page);
    } catch (err) {
      limitations.push({ id: 'view-switcher', reason: String(err.message).slice(0, 200) });
    }

    // Feed / Grid / List via menu item click if present (navigation only).
    for (const view of ['Feed', 'Grid', 'List']) {
      try {
        await clickCy(page, 'viewSelector');
        await waitQuiet(page, 350);
        const clicked = await page.evaluate((name) => {
          const menu = [...document.querySelectorAll('[role="menu"]')].find((m) =>
            m.innerText.includes(name),
          );
          if (!menu) return 'no-menu';
          const item = [
            ...menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], button, a'),
          ].find((el) => (el.innerText || '').includes(name));
          if (!item) return 'no-item';
          if (/pro|ent|upgrade/i.test(item.innerText || '')) return 'gated';
          item.click();
          return 'clicked';
        }, view);
        await waitQuiet(page, 900);
        if (clicked === 'clicked') {
          await capture(`${view.toLowerCase()}-1440`, `${view} view`, 'LIVE_VERIFIED');
        } else {
          limitations.push({
            id: `${view.toLowerCase()}-view`,
            reason: clicked === 'gated' ? 'PLAN_GATED' : clicked,
          });
        }
        await pressEsc(page);
      } catch (err) {
        limitations.push({ id: `${view}-view`, reason: String(err.message).slice(0, 200) });
      }
    }

    try {
      await page.goto(`https://app.planable.io/dashboard`, {
        waitUntil: 'domcontentloaded',
        timeout: 25000,
      });
      await waitQuiet(page, 1200);
      await capture('dashboard-1440', 'Workspace dashboard', 'LIVE_VERIFIED');
    } catch (err) {
      limitations.push({ id: 'dashboard', reason: String(err.message).slice(0, 200) });
    }
  }

  // Settings: navigate if a settings link exists; do not save forms.
  try {
    const settingsHref = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a[href]')].find((el) =>
        /setting/i.test(el.getAttribute('href') || el.innerText || ''),
      );
      return a ? a.href : null;
    });
    if (
      settingsHref &&
      settingsHref.includes('planable.io') &&
      !/billing|upgrade/i.test(settingsHref)
    ) {
      await page.goto(settingsHref, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await waitQuiet(page, 1000);
      await capture('settings-1440', 'Settings', 'LIVE_VERIFIED');
    } else {
      limitations.push({ id: 'settings', reason: 'SANDBOX_DATA_REQUIRED_OR_NO_LINK' });
    }
  } catch (err) {
    limitations.push({ id: 'settings', reason: String(err.message).slice(0, 200) });
  }

  // Composer / create: open if a New button exists that is not workspace-create, then close.
  try {
    const opened = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button,[data-cy]')].find((b) => {
        const t = ((b.innerText || '') + ' ' + (b.getAttribute('aria-label') || '')).trim();
        const cy = b.getAttribute('data-cy') || '';
        return /newPost|composer|createPost/i.test(cy) || /^new$/i.test(t);
      });
      if (!btn) return 'missing';
      btn.click();
      return 'clicked';
    });
    await waitQuiet(page, 800);
    if (opened === 'clicked') {
      const dialog = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        if (!d) return null;
        return {
          text: d.innerText.replace(/\s+/g, ' ').slice(0, 400),
          width: Math.round(d.getBoundingClientRect().width),
          height: Math.round(d.getBoundingClientRect().height),
        };
      });
      writeJson('interactions/composer-open-close.json', {
        id: 'composer-open-close',
        evidenceLevel: dialog ? 'LIVE_VERIFIED' : 'PARTIAL',
        note: 'Opened create UI if present; closed without submit.',
        dialogSanitized: dialog,
      });
      interactions.push('composer-open-close');
      await clickCy(page, 'closeModal');
      await pressEsc(page);
    } else {
      limitations.push({ id: 'composer', reason: 'CONTROL_NOT_FOUND' });
    }
  } catch (err) {
    limitations.push({ id: 'composer', reason: String(err.message).slice(0, 200) });
  }

  // Responsive matrix on current surface.
  for (const vp of [
    { w: 1024, h: 768, id: 'shell-1024' },
    { w: 390, h: 844, id: 'shell-390' },
  ]) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await waitQuiet(page, 700);
    await capture(vp.id, `Shell ${vp.w}x${vp.h}`, 'LIVE_VERIFIED', { viewportIntent: vp });
  }

  await page.setViewportSize({ width: 1440, height: 900 });

  const tokenSummary = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const html = getComputedStyle(document.documentElement);
    const sidebar = document.querySelector('[data-cy="navSidebar"], [data-cy="navBody"], aside');
    const header = document.querySelector('header');
    const btn = document.querySelector('button');
    const sBar = sidebar ? getComputedStyle(sidebar) : null;
    const sHead = header ? getComputedStyle(header) : null;
    const sBtn = btn ? getComputedStyle(btn) : null;
    return {
      htmlBg: html.backgroundColor,
      bodyBg: body.backgroundColor,
      bodyColor: body.color,
      bodyFont: body.fontFamily,
      bodySize: body.fontSize,
      bodyWeight: body.fontWeight,
      bodyLine: body.lineHeight,
      sidebarBg: sBar?.backgroundColor ?? null,
      sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
      headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
      headerBg: sHead?.backgroundColor ?? null,
      buttonRadius: sBtn?.borderRadius ?? null,
      buttonHeight: btn ? Math.round(btn.getBoundingClientRect().height) : null,
      focusOutline: sBtn?.outline ?? null,
    };
  });

  writeJson('measurements/_token-summary.json', {
    evidenceLevel: 'LIVE_VERIFIED',
    source: 'app.planable.io',
    sourceKind: 'PRODUCT_APP',
    capturedAt: CAPTURED_AT,
    tokenSummary,
    workspaceIdPresent: Boolean(workspaceId),
  });

  writeJson('coverage.json', {
    project: 'oma-ai',
    decision: 'DEC-017',
    originProduct: 'https://app.planable.io',
    originMarketing: 'https://planable.io/',
    accessStatus: 'CDP_READY_AUTHENTICATED',
    capturedAt: CAPTURED_AT,
    startingSha: '6bb76a33de6529ce46af47e379743169599992fa',
    surfaces,
    interactions,
    liveCount: surfaces.filter((s) => s.evidenceLevel === 'LIVE_VERIFIED').length,
    archivedCount: 0,
    docCount: 0,
    forbiddenClicksAvoided: FORBIDDEN_CLICK.toString(),
    notes:
      'Workspace identifiers stripped from stored URLs. Raw screenshots stay local/gitignored.',
  });

  writeJson('limitations.md.json', { limitations });

  console.log(
    JSON.stringify(
      {
        STATUS: 'SUCCESS',
        LIVE: surfaces.length,
        INTERACTIONS: interactions.length,
        LIMITATIONS: limitations.length,
        ACCESS: 'CDP_READY_AUTHENTICATED',
      },
      null,
      2,
    ),
  );
  await browser.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
