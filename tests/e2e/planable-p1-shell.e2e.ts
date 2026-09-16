import { test, expect } from '@playwright/test';
import { installOwnerSession } from './helpers/brand-ui';
import { msg } from './helpers/i18n';

test.describe('P1 Planable shell tokens', () => {
  test.describe.configure({ timeout: 90_000 });

  test('PV-G / PV-SHELL computed styles at 1440', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'desktop Planable metrics');
    await installOwnerSession(page, request);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await expect(page.locator('.oma-shell')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const rail = document.querySelector('.oma-rail');
      const create = document.querySelector('[data-testid="shell-create"]');
      const railCs = rail ? getComputedStyle(rail) : null;
      const createCs = create ? getComputedStyle(create) : null;
      const rgb = (value: string) => {
        const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
      };
      const within = (got: number[] | null, exp: number[]) =>
        !!got && got.every((n, i) => Math.abs(n - exp[i]) <= 2);
      return {
        fontFamily: body.fontFamily,
        fontSize: body.fontSize,
        canvas: body.backgroundColor,
        ink: body.color,
        canvasOk: within(rgb(body.backgroundColor), [245, 246, 247]),
        inkOk: within(rgb(body.color), [51, 51, 51]),
        railWidth: rail ? Math.round(rail.getBoundingClientRect().width) : 0,
        railMotion: railCs?.transitionDuration ?? '',
        railEase: railCs?.transitionTimingFunction ?? '',
        createHeight: create ? Math.round(create.getBoundingClientRect().height) : 0,
        createRadius: createCs?.borderRadius ?? '',
        createBg: createCs?.backgroundColor ?? '',
        primaryOk: createCs ? within(rgb(createCs.backgroundColor), [22, 119, 255]) : false,
        overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        typeface: document.documentElement.getAttribute('data-oma-typeface'),
      };
    });

    expect(metrics.typeface).toBe('planable-system');
    expect(metrics.fontFamily.toLowerCase()).toMatch(/system-ui|segoe ui|-apple-system|roboto/);
    expect(metrics.fontFamily.toLowerCase()).not.toMatch(/inter|ibm plex/);
    expect(metrics.fontSize).toBe('14px');
    expect(metrics.canvasOk).toBe(true);
    expect(metrics.inkOk).toBe(true);
    expect(metrics.railWidth).toBeGreaterThanOrEqual(252);
    expect(metrics.railWidth).toBeLessThanOrEqual(260);
    expect(metrics.createHeight).toBeGreaterThanOrEqual(30);
    expect(metrics.createHeight).toBeLessThanOrEqual(34);
    expect(metrics.createRadius).toMatch(/^6px/);
    expect(metrics.primaryOk).toBe(true);
    expect(metrics.railMotion).toMatch(/0\.15s|150ms/);
    expect(metrics.overflow).toBe(true);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await expect(page.locator('.oma-shell')).toBeVisible();
    const reduced = await page.evaluate(() => {
      const rail = document.querySelector('.oma-rail');
      const btn = document.querySelector('[data-testid="shell-create"]');
      return {
        rail: rail ? getComputedStyle(rail).transitionDuration : '',
        btn: btn ? getComputedStyle(btn).transitionDuration : '',
      };
    });
    expect(reduced.rail).toMatch(/0\.01ms|0s|1e-05s/);
    expect(reduced.btn).toMatch(/0\.01ms|0s|1e-05s/);
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/app');
    await expect(page.locator('.oma-shell')).toBeVisible();
    const navBox = await page.locator('.oma-rail .oma-nav').boundingBox();
    const footerBox = await page.locator('.oma-rail .oma-rail-footer').boundingBox();
    expect(navBox, 'rail nav box at 1024').toBeTruthy();
    expect(footerBox, 'rail footer box at 1024').toBeTruthy();
    if (navBox && footerBox) {
      expect(footerBox.y).toBeGreaterThanOrEqual(navBox.y + navBox.height - 2);
    }
    await expect(
      page.locator('.oma-rail').getByRole('button', { name: msg(testInfo, 'shell.account') }),
    ).toBeVisible();
    await expect(
      page.locator('.oma-rail').getByRole('button', { name: msg(testInfo, 'shell.notifications') }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app');
    await expect(page.locator('.oma-rail')).toBeHidden();
    await expect(page.getByRole('button', { name: msg(testInfo, 'shell.openNav') })).toBeVisible();
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    expect(mobileOverflow).toBe(true);
  });
});
