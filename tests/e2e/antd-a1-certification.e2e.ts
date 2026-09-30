import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { installOwnerSession } from './helpers/brand-ui';

const SHOTS = join(process.cwd(), 'artifacts/planable-ant-design-a1/oma');
const META_DIR = join(process.cwd(), '.reference/008-planable-ant-design-a1');

type Shot = {
  name: string;
  viewport: { width: number; height: number };
  locale: string;
  dir: string;
  overflow: boolean;
  hydrationErrors: string[];
  control: Record<string, string | number | null>;
  activeTag: string | null;
};

async function probe(page: Page, name: string, locale: string) {
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const hydrationErrors: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (/hydration|did not match/i.test(text)) hydrationErrors.push(text.slice(0, 180));
  });
  const facts = await page.evaluate(() => {
    const el = document.documentElement;
    const button = document.querySelector('.ant-btn-primary, .ant-btn') as HTMLElement | null;
    const cs = button ? getComputedStyle(button) : null;
    return {
      dir: el.dir,
      overflow: el.scrollWidth > el.clientWidth + 1,
      activeTag: document.activeElement?.tagName ?? null,
      control: button
        ? {
            height: Math.round(button.getBoundingClientRect().height),
            fontSize: cs?.fontSize ?? null,
            borderRadius: cs?.borderRadius ?? null,
            backgroundColor: cs?.backgroundColor ?? null,
            color: cs?.color ?? null,
            transitionDuration: cs?.transitionDuration ?? null,
          }
        : {
            height: null,
            fontSize: null,
            borderRadius: null,
            backgroundColor: null,
            color: null,
            transitionDuration: null,
          },
      activeTag: document.activeElement?.tagName ?? null,
    };
  });
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false });
  const shot: Shot = {
    name,
    viewport,
    locale,
    dir: facts.dir,
    overflow: facts.overflow,
    activeTag: facts.activeTag,
    hydrationErrors,
    control: facts.control,
  };
  expect(facts.overflow, name).toBe(false);
  expect(hydrationErrors, name).toEqual([]);
  return shot;
}

test('A1 foundation visual and interaction evidence', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'en-desktop',
    'A1 evidence is captured once, then resized inside this project',
  );
  mkdirSync(META_DIR, { recursive: true });
  const shots: Shot[] = [];
  await installOwnerSession(page, page.request);

  const views = [
    { name: 'en-1440', width: 1440, height: 900, locale: 'en' },
    { name: 'en-1024', width: 1024, height: 768, locale: 'en' },
    { name: 'en-390', width: 390, height: 844, locale: 'en' },
    { name: 'ar-1440', width: 1440, height: 900, locale: 'ar' },
    { name: 'ar-390', width: 390, height: 844, locale: 'ar' },
  ] as const;

  for (const view of views) {
    await page.setViewportSize({ width: view.width, height: view.height });
    await page.context().addCookies([
      {
        name: 'oma_locale',
        value: view.locale,
        url: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3100',
      },
    ]);
    await page.goto('/app');
    await expect(page.locator('html')).toHaveAttribute('dir', view.locale === 'ar' ? 'rtl' : 'ltr');
    shots.push(await probe(page, `${view.name}-shell`, view.locale));
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .context()
    .addCookies([
      { name: 'oma_locale', value: 'en', url: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3100' },
    ]);
  await page.goto('/app/brands/new');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const name = page.locator('#brand-name');
  await name.focus();
  const submit = dialog.getByRole('button', { name: /create brand|إنشاء/i });
  await expect(submit).toBeDisabled();
  shots.push(await probe(page, 'en-1440-brand-focus', 'en'));
  let releaseBrand!: () => void;
  const holdBrand = new Promise<void>((resolve) => {
    releaseBrand = resolve;
  });
  await page.route('**/api/v1/brands', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await holdBrand;
    return route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Certification check' } }),
    });
  });
  await name.fill('Certification brand');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(submit).toHaveClass(/ant-btn-loading/);
  shots.push(await probe(page, 'en-1440-brand-loading', 'en'));
  releaseBrand();
  await expect(dialog.getByText('Certification check')).toBeVisible();
  shots.push(await probe(page, 'en-1440-brand-error', 'en'));
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.goto('/app/content');
  await expect(page.getByTestId('demo-content-filters')).toBeVisible();
  await page.getByTestId('demo-content-open-filters').click();
  await expect(page.getByTestId('demo-content-filter-sheet')).toBeVisible();
  const dateField = page.locator('.ant-picker').first();
  await expect(dateField).toBeVisible();
  await dateField.click();
  await expect(page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)')).toBeVisible();
  shots.push(await probe(page, 'en-1440-date-filter', 'en'));
  await page.keyboard.press('Escape');
  await page.getByTestId('demo-content-filter-approval').click();
  await expect(page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')).toBeVisible();
  shots.push(await probe(page, 'en-1440-dropdown', 'en'));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('demo-content-filter-sheet')).toHaveCount(0);
  await page.getByTestId('demo-create-content').click();
  await expect(page.getByTestId('demo-create-content-dialog')).toBeVisible();
  shots.push(await probe(page, 'en-1440-composer', 'en'));
  await page.keyboard.press('Escape');

  await page.goto('/app/requests');
  await page.getByTestId('demo-create-request').click();
  await expect(page.getByTestId('demo-create-request-dialog')).toBeVisible();
  shots.push(await probe(page, 'en-1440-request', 'en'));
  await page.keyboard.press('Escape');

  await page.goto('/app/tasks?task=demo-task-design');
  await expect(page.getByTestId('demo-task-drawer')).toBeVisible();
  shots.push(await probe(page, 'en-1440-task-drawer', 'en'));
  await page.keyboard.press('Escape');

  await page.goto('/app');
  // The intentional 422 is a real validation response. Next's dev overlay treats it as an issue
  // and covers later clicks. Production has no overlay.
  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach((node) => node.remove());
  });
  await page.getByTestId('shell-notifications-trigger').click();
  await expect(page.getByTestId('shell-notifications-panel')).toBeVisible();
  shots.push(await probe(page, 'en-1440-notifications', 'en'));

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/app');
  shots.push(await probe(page, 'en-1440-reduced-motion', 'en'));

  const primary = page.locator('.ant-btn').first();
  const box = await primary.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(30);
  expect(box?.height ?? 0).toBeLessThanOrEqual(34);

  writeFileSync(
    join(META_DIR, 'oma-captures.json'),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        tree: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        shots,
      },
      null,
      2,
    ),
  );
});
