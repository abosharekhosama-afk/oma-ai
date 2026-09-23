import { chromium } from '@playwright/test';
import fs from 'node:fs';

const out = 'artifacts/planable-oma-visual-differential/w1-remediation/oma';
fs.mkdirSync(out, { recursive: true });
const creds = JSON.parse(fs.readFileSync('.review/004-credentials.json', 'utf8')).accounts.owner;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const t0 = Date.now();
const frames = [];
function mark(name) {
  frames.push({ name, atMs: Date.now() - t0 });
}
await page.goto('http://127.0.0.1:3000/login');
await page.waitForSelector('[data-auth-ready="1"]');
await page.locator('input[name=email]').fill(creds.email);
await page.locator('input[name=password]').fill(creds.password);
await page.locator('button[type=submit]').click();
await page.waitForURL(/\/app/);
await page.goto('http://127.0.0.1:3000/app/content');
await page.getByTestId('demo-content').waitFor();
mark('content-open');
for (const mode of ['feed', 'list', 'grid', 'calendar']) {
  await page.getByTestId(`demo-content-view-${mode}`).click();
  await page.waitForTimeout(200);
  mark(`view-${mode}`);
  await page.screenshot({ path: `${out}/${mode}-1440.png` });
}
const card = page.locator('.oma-post-card--calendar').first();
if (await card.count()) {
  const box = await card.evaluate((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      pad: s.padding,
      radius: s.borderRadius,
      border: s.borderTopWidth + ' ' + s.borderTopColor,
      gap: s.gap,
      dur: s.transitionDuration,
    };
  });
  fs.writeFileSync(`${out}/card-measure.json`, JSON.stringify(box, null, 2));
  mark('card-measured');
  await page.screenshot({ path: `${out}/card-hover-1440.png` });
}
await page.getByTestId('demo-content-filter-approval').selectOption('PARTIALLY_APPROVED');
mark('partial-filter');
await page.screenshot({ path: `${out}/partial-filter-1440.png` });
await page.emulateMedia({ reducedMotion: 'reduce' });
mark('reduced-motion');
await page.keyboard.press('Tab');
mark('keyboard-tab');
fs.writeFileSync(
  `${out}/interaction-frames.json`,
  JSON.stringify({ frames, easing: 'ease-out', durationMs: 150 }, null, 2),
);
await context.close();
await browser.close();
console.log('recorded', frames.length);
