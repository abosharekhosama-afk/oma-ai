import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';

const BASE = 'http://127.0.0.1:3000';
const API = 'http://127.0.0.1:3001';
const EMAIL = process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL || 'platform-owner@example.com';
const PASS = process.env.BOOTSTRAP_PLATFORM_OWNER_PASSWORD || 'ChangeMe_PlatformOwner_1!';
const DEMO_TENANT = '01M6BAM32840YSR60NYBVBWSB2';

function apiLogin() {
  const jar = '/tmp/oma-verify-footer-cookies.txt';
  try {
    fs.unlinkSync(jar);
  } catch {}
  const login = execSync(
    `curl -s -c ${jar} -b ${jar} -X POST ${API}/api/v1/auth/login -H 'content-type: application/json' -d '${JSON.stringify({ email: EMAIL, password: PASS })}'`,
    { encoding: 'utf8' },
  );
  const parsed = JSON.parse(login);
  if (!parsed.csrf_token) throw new Error(`login failed: ${login}`);
  execSync(
    `curl -s -c ${jar} -b ${jar} -X POST ${API}/api/v1/tenants/active -H 'content-type: application/json' -H 'x-csrf-token: ${parsed.csrf_token}' -d '${JSON.stringify({ tenant_id: DEMO_TENANT })}'`,
    { encoding: 'utf8' },
  );
  const raw = fs.readFileSync(jar, 'utf8');
  const session = (raw.match(/oma_session\s+(\S+)/) || [])[1];
  const csrf = (raw.match(/oma_csrf\s+(\S+)/) || [])[1] || parsed.csrf_token;
  return { session, csrf };
}

const ROUTES = [
  '/app/activity',
  '/app/content',
  '/app/team',
  '/app/schedule',
  '/app/billing',
  '/app/settings',
];
const VIEWPORTS = [
  { w: 1366, h: 768, n: '1366x768' },
  { w: 1440, h: 900, n: '1440x900' },
  { w: 1920, h: 1080, n: '1920x1080' },
  { w: 1280, h: 700, n: 'short700' },
  { w: 1024, h: 768, n: 'tablet' },
];

const cookies = apiLogin();
const browser = await chromium.launch({ headless: true });
const failures = [];
try {
  for (const vp of VIEWPORTS) {
    for (const route of ROUTES) {
      const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      await context.addCookies([
        { name: 'oma_session', value: cookies.session, url: BASE, httpOnly: true },
        { name: 'oma_csrf', value: cookies.csrf, url: BASE },
        { name: 'oma_locale', value: 'en', url: BASE },
      ]);
      const page = await context.newPage();
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1200);
      const info = await page.evaluate(() => {
        const footer =
          document.querySelector('[data-testid="shell-rail-utilities"]') ||
          document.querySelector('.oma-shell > .oma-rail > .oma-rail-footer');
        if (!footer) return { found: false };
        const r = footer.getBoundingClientRect();
        const cs = getComputedStyle(footer);
        return {
          found: true,
          visible: cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0',
          y: r.y,
          h: r.height,
          bottom: r.bottom,
          vh: window.innerHeight,
        };
      });
      const ok = info.found && info.visible && info.h > 20 && info.bottom <= vp.h + 2;
      console.log(`${ok ? 'OK' : 'FAIL'} ${route} @ ${vp.n}`, info);
      if (!ok) failures.push(`${route}@${vp.n}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error('FAILURES', failures);
  process.exit(1);
}
console.log('ALL_OK', VIEWPORTS.length * ROUTES.length);
