#!/usr/bin/env node
/**
 * Launches Chrome with a dedicated, gitignored reference profile and a
 * loopback-only CDP endpoint. Cross-platform by design: the reference pack this
 * pattern came from was Windows-only, which is not usable here.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { platform } from 'node:process';
import { cdpBase, ensureDir, loadConfig, parseArgs } from './lib/config.mjs';
import { EXIT, printCompact } from './lib/compact.mjs';

const CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
};

function resolveBrowser() {
  if (process.env.OMA_REFERENCE_BROWSER) {
    return existsSync(process.env.OMA_REFERENCE_BROWSER) ? process.env.OMA_REFERENCE_BROWSER : null;
  }
  const list = CANDIDATES[platform] ?? [];
  return list.find((candidate) => existsSync(candidate)) ?? null;
}

async function alreadyRunning(config) {
  try {
    const res = await fetch(`${cdpBase(config)}/json/version`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.reference ?? null);

  if (await alreadyRunning(config)) {
    printCompact({
      STATUS: 'ALREADY_RUNNING',
      MODE: 'LAUNCH',
      REASON: `CDP already responding at ${cdpBase(config)}`,
      NEXT: 'pnpm ref:preflight',
    });
    return EXIT.SUCCESS;
  }

  const browser = resolveBrowser();
  if (!browser) {
    printCompact({
      STATUS: 'BLOCKED',
      MODE: 'LAUNCH',
      REASON: `no Chrome/Chromium binary found for platform "${platform}"`,
      NEXT: 'set OMA_REFERENCE_BROWSER to the browser executable path',
    });
    return EXIT.BLOCKED;
  }

  const profileDir = ensureDir(config.profileDirAbsolute);
  const child = spawn(
    browser,
    [
      `--remote-debugging-port=${config.cdp.port}`,
      `--remote-debugging-address=${config.cdp.host}`,
      `--user-data-dir=${profileDir}`,
      `--window-size=${config.viewport.width},${config.viewport.height}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
    { detached: true, stdio: 'ignore' },
  );
  child.unref();

  // Confirm the endpoint actually comes up rather than reporting optimistically.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((r) => setTimeout(r, 500));
    if (await alreadyRunning(config)) {
      printCompact({
        STATUS: 'SUCCESS',
        MODE: 'LAUNCH',
        REASON: `${browser} on ${cdpBase(config)} with profile ${config.profileDir}`,
        NEXT: 'sign in to the reference product once, then pnpm ref:preflight',
      });
      return EXIT.SUCCESS;
    }
  }

  printCompact({
    STATUS: 'BLOCKED',
    MODE: 'LAUNCH',
    REASON: 'browser started but CDP endpoint never responded',
    NEXT: 'check whether another Chrome instance owns the profile directory',
  });
  return EXIT.BLOCKED;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    printCompact({ STATUS: 'BLOCKED', MODE: 'LAUNCH', REASON: err.message });
    process.exit(EXIT.BLOCKED);
  },
);
