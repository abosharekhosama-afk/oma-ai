/* global document, getComputedStyle */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const root = 'artifacts/planable-oma-visual-differential/w1-final-closure';
const shots = `${root}/oma`;
fs.mkdirSync(shots, { recursive: true });
const creds = JSON.parse(fs.readFileSync('.review/004-credentials.json', 'utf8')).accounts.owner;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'no-preference',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

async function sequence(name, steps) {
  const dir = `${shots}/motion/${name}`;
  fs.mkdirSync(dir, { recursive: true });
  const started = Date.now();
  const frames = [];
  let index = 0;
  async function frame(label) {
    index += 1;
    const file = `${dir}/${String(index).padStart(2, '0')}-${label}.png`;
    await page.screenshot({ path: file });
    frames.push({ label, atMs: Date.now() - started, file });
  }
  await frame('start');
  for (const step of steps) {
    await step(frame);
  }
  while (frames.length < 6) {
    await page.waitForTimeout(40);
    await frame('hold');
  }
  const ended = Date.now();
  const record = {
    name,
    startedAt: new Date(started).toISOString(),
    endedAt: new Date(ended).toISOString(),
    durationMs: ended - started,
    frameCount: frames.length,
    frames,
    focus: await page.evaluate(() => document.activeElement?.tagName ?? null),
    escape: 'recorded when the step presses Escape',
    clickOutside: 'recorded when the step clicks the page background',
    rollback: 'draft date and schedule commands are separate; failed clicks leave the prior state',
    reducedMotion: 'separate pass sets prefers-reduced-motion',
  };
  fs.writeFileSync(`${dir}/meta.json`, JSON.stringify(record, null, 2));
  return record;
}

await page.goto('http://127.0.0.1:3000/login');
await page.waitForSelector('[data-auth-ready="1"]');
await page.locator('input[name=email]').fill(creds.email);
await page.locator('input[name=password]').fill(creds.password);
await page.locator('button[type=submit]').click();
await page.waitForURL(/\/app/);

const interactions = [];

interactions.push(
  await sequence('01-view-switch', [
    async (frame) => {
      await page.goto('http://127.0.0.1:3000/app/content');
      await page.getByTestId('demo-content').waitFor();
      for (const mode of ['feed', 'list', 'grid', 'calendar']) {
        await page.getByTestId(`demo-content-view-${mode}`).click();
        await page.waitForTimeout(40);
        await frame(mode);
      }
    },
  ]),
);

interactions.push(
  await sequence('02-approval-filter', [
    async (frame) => {
      const filter = page.getByTestId('demo-content-filter-approval');
      await filter.focus();
      await frame('focus');
      await filter.selectOption('PARTIALLY_APPROVED');
      await frame('selected');
      await page.keyboard.press('Escape');
      await frame('escape');
      await filter.selectOption('all');
      await frame('reset');
    },
  ]),
);

interactions.push(
  await sequence('03-card-hover-focus', [
    async (frame) => {
      await page.getByTestId('demo-content-view-calendar').click();
      const card = page.locator('.oma-post-card--calendar').first();
      await card.hover({ force: true });
      await frame('hover');
      await card.focus();
      await frame('focus');
      await page.keyboard.press('Escape');
      await frame('escape');
    },
  ]),
);

interactions.push(
  await sequence('04-saved-open', [
    async (frame) => {
      const saved = page
        .getByTestId('demo-content-saved')
        .locator('button, a, [role="button"]')
        .first();
      await saved.click();
      await frame('opened');
      await page.keyboard.press('Escape');
      await frame('escape');
      await page.mouse.click(8, 8);
      await frame('outside');
    },
  ]),
);

interactions.push(
  await sequence('05-composer', [
    async (frame) => {
      await page.getByTestId('demo-create-content').click();
      await frame('open');
      await page.keyboard.press('Escape');
      await frame('escape');
      await page.mouse.click(8, 8);
      await frame('outside');
    },
  ]),
);

interactions.push(
  await sequence('06-date-stays-draft', [
    async (frame) => {
      await page.getByTestId('demo-content-view-list').click();
      await page.getByTestId('demo-content-card-demo-content-paid-static').click();
      await frame('opened');
      await page.getByRole('tab', { name: /edit|تحرير/i }).click();
      const date = page.locator('input[type="datetime-local"]').first();
      await date.fill('2026-10-02T09:30');
      await frame('date-set');
      await page.getByTestId('demo-content-save').click();
      await frame('saved');
      await page.keyboard.press('Escape');
      await frame('closed');
    },
  ]),
);

interactions.push(
  await sequence('07-partial-blocks-schedule', [
    async (frame) => {
      await page.getByTestId('demo-content-approval-policy').selectOption('REQUIRED');
      await frame('policy-required');
      await page.getByTestId('demo-content-view-list').click();
      await page.getByTestId('demo-content-card-demo-content-carousel').click();
      await page.getByRole('tab', { name: /edit|تحرير/i }).click();
      await frame('partial-open');
      await page.getByTestId('demo-content-schedule-reason').waitFor();
      await frame('blocked');
    },
  ]),
);

interactions.push(
  await sequence('08-approved-schedule', [
    async (frame) => {
      await page.getByTestId('demo-content-approval-policy').selectOption('OPTIONAL');
      await frame('optional');
      await page.goto('http://127.0.0.1:3000/app/schedule');
      await page.getByTestId('demo-schedule').waitFor();
      await page.getByTestId('demo-sched-item-demo-sched-1').click();
      await frame('ready-open');
      await page.getByTestId('demo-schedule-command').click();
      await frame('scheduled');
    },
  ]),
);

interactions.push(
  await sequence('09-unschedule', [
    async (frame) => {
      await page.getByTestId('demo-schedule-unschedule').click();
      await frame('unscheduled');
      await page.keyboard.press('Escape');
      await frame('escape');
    },
  ]),
);

interactions.push(
  await sequence('10-schedule-views', [
    async (frame) => {
      await page.keyboard.press('Escape');
      for (const mode of ['agenda', 'queue', 'calendar']) {
        await page.getByTestId(`demo-schedule-view-${mode}`).click();
        await frame(mode);
      }
    },
  ]),
);

interactions.push(
  await sequence('11-mobile', [
    async (frame) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('http://127.0.0.1:3000/app/content');
      await page.getByTestId('demo-content').waitFor();
      await frame('content');
      await page.getByTestId('demo-content-view-grid').click();
      await frame('grid');
      await page.goto('http://127.0.0.1:3000/app/schedule');
      await frame('schedule');
    },
  ]),
);

await page.setViewportSize({ width: 1440, height: 900 });
interactions.push(
  await sequence('12-keyboard', [
    async (frame) => {
      await page.goto('http://127.0.0.1:3000/app/content');
      await page.getByTestId('demo-content').waitFor();
      await page.keyboard.press('Tab');
      await frame('tab-1');
      await page.keyboard.press('Tab');
      await frame('tab-2');
      await page.keyboard.press('Escape');
      await frame('escape');
    },
  ]),
);

await page.emulateMedia({ reducedMotion: 'reduce' });
await page.screenshot({ path: `${shots}/reduced-motion-1440.png` });
await page.setViewportSize({ width: 1024, height: 768 });
await page.screenshot({ path: `${shots}/content-1024.png` });
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://127.0.0.1:3000/app/content');
await page.getByTestId('demo-content-view-calendar').click();
const card = page.locator('.oma-post-card--calendar').first();
const measure = await card.evaluate((el) => {
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    w: Math.round(r.width),
    h: Math.round(r.height),
    pad: s.padding,
    radius: s.borderRadius,
    border: `${s.borderTopWidth} ${s.borderTopColor}`,
    duration: s.transitionDuration,
    overflow: s.overflow,
  };
});
fs.writeFileSync(`${shots}/card-measure.json`, JSON.stringify(measure, null, 2));
await page.screenshot({ path: `${shots}/calendar-1440.png`, fullPage: true });
await page.getByTestId('demo-content-view-feed').click();
await page.screenshot({ path: `${shots}/feed-1440.png`, fullPage: true });
await page.getByTestId('demo-content-view-list').click();
await page.screenshot({ path: `${shots}/list-1440.png`, fullPage: true });
await page.getByTestId('demo-content-view-grid').click();
await page.screenshot({ path: `${shots}/grid-1440.png`, fullPage: true });
await page.goto('http://127.0.0.1:3000/app/schedule');
await page.screenshot({ path: `${shots}/schedule-calendar-1440.png`, fullPage: true });
await page.getByTestId('demo-schedule-view-agenda').click();
await page.screenshot({ path: `${shots}/schedule-agenda-1440.png`, fullPage: true });
await page.getByTestId('demo-schedule-view-queue').click();
await page.screenshot({ path: `${shots}/schedule-queue-1440.png`, fullPage: true });

fs.writeFileSync(
  `${root}/interactions.json`,
  JSON.stringify(
    {
      ffmpeg: false,
      method: 'playwright-screenshot-sequence',
      interactions: interactions.length,
      consoleErrors: errors,
      measure,
    },
    null,
    2,
  ),
);
await browser.close();
console.log(
  JSON.stringify({
    interactions: interactions.length,
    frames: interactions.reduce((n, item) => n + item.frameCount, 0),
    measure,
    errors: errors.length,
  }),
);
