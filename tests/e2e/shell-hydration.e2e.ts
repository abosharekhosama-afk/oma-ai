import { expect, test, type Page } from '@playwright/test';
import { t, type Locale } from '@oma/i18n';
import { apiPost } from './helpers/brand-api';
import { installOwnerSession, openPrimaryNavIfNeeded, webOrigin } from './helpers/brand-ui';
import { projectLocale } from './helpers/i18n';

function watchShell(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' || /hydrat|recoverable|did not match|didn't match/i.test(text)) {
      errors.push(text);
    }
  });
  return errors;
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

async function expectShell(page: Page, locale: Locale, errors: string[], parts: string[]) {
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('.oma-shell')).toHaveAttribute('data-shell-hydrated', 'true');
  const trail = page.locator('nav.oma-context-trail');
  await expect(trail).toBeVisible();
  const text = normalize(await trail.innerText());
  for (const part of parts) expect(text).toContain(part);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
  expect(errors, errors.join('\n')).toEqual([]);
  return text;
}

test('shell breadcrumbs hydrate on direct reload in EN, AR, desktop, and mobile', async ({
  page,
  request,
}, testInfo) => {
  const errors = watchShell(page);
  const locale = projectLocale(testInfo);
  await page.context().addCookies([{ name: 'oma_locale', value: locale, url: webOrigin() }]);

  const owner = await installOwnerSession(page, request);
  const brandRes = await apiPost(request, '/api/v1/brands', owner.cookies, {
    name: `Hydration ${locale}`,
  });
  expect(brandRes.ok(), await brandRes.text()).toBeTruthy();
  const brandId = ((await brandRes.json()) as { data: { id: string } }).data.id;
  const strategyRes = await apiPost(
    request,
    `/api/v1/brands/${brandId}/strategies`,
    owner.cookies,
    { name: 'Hydration strategy' },
  );
  expect(strategyRes.ok(), await strategyRes.text()).toBeTruthy();
  const strategyId = ((await strategyRes.json()) as { data: { id: string } }).data.id;

  const home = t(locale, 'nav.home');
  const routes: Array<{ path: string; parts: string[] }> = [
    { path: '/app', parts: [home] },
    { path: '/app/brands', parts: [home, t(locale, 'nav.intelligence')] },
    { path: `/app/brands/${brandId}`, parts: [home, t(locale, 'nav.intelligence'), brandId] },
    {
      path: `/app/brands/${brandId}/strategies/${strategyId}`,
      parts: [home, t(locale, 'nav.intelligence'), brandId, 'strategies', strategyId],
    },
    { path: '/app/content', parts: [home, t(locale, 'nav.content')] },
    { path: '/app/tasks', parts: [home, t(locale, 'nav.tasks')] },
    { path: '/app/reviews', parts: [home, t(locale, 'nav.reviews')] },
    { path: '/app/settings', parts: [home, t(locale, 'nav.settings')] },
  ];

  for (const route of routes) {
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(response?.status() ?? 0).toBeLessThan(500);
    const before = await expectShell(page, locale, errors, route.parts);
    const reloaded = await page.reload({ waitUntil: 'domcontentloaded' });
    expect(reloaded?.status() ?? 0).toBeLessThan(500);
    const after = await expectShell(page, locale, errors, route.parts);
    expect(after).toBe(before);
    if (route.path !== '/app') {
      await expect(
        page.locator('nav.oma-context-trail').getByRole('link', { name: home }),
      ).toHaveAttribute('href', '/app');
    }
    await expect(page.locator('nav.oma-context-trail [aria-current="page"]')).toBeVisible();
  }

  await page.goto('/app', { waitUntil: 'domcontentloaded' });
  await openPrimaryNavIfNeeded(page);
  const dialog = page.getByRole('dialog', { name: t(locale, 'nav.primary') });
  const scope = (await dialog.isVisible()) ? dialog : page.locator('.oma-rail');
  await scope.getByRole('link', { name: t(locale, 'nav.reviews') }).click();
  await page.waitForURL('**/app/reviews');
  const navigated = await expectShell(page, locale, errors, [home, t(locale, 'nav.reviews')]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const reloaded = await expectShell(page, locale, errors, [home, t(locale, 'nav.reviews')]);
  expect(reloaded).toBe(navigated);
});
