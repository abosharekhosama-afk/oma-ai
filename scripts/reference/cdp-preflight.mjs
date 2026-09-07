#!/usr/bin/env node
/**
 * Deterministic readiness check. Returns exactly one status from the vocabulary
 * in docs/REFERENCE_PARITY_PROTOCOL.md so that "no session exists" can never be
 * reported when the real cause is the wrong profile, port, or workspace.
 */
import { cdpBase, findReference, loadConfig, parseArgs } from './lib/config.mjs';
import { EXIT, printCompact } from './lib/compact.mjs';

const LOGIN_HINT = /\/(login|signin|sign-in|auth|sso|oauth|mfa|challenge|verify)(\/|\?|$)/i;

async function cdpJson(config, path) {
  const res = await fetch(`${cdpBase(config)}${path}`, {
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });
  if (!res.ok) throw new Error(`CDP ${path} responded ${res.status}`);
  return res.json();
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const referenceId = args.reference ?? null;
  const reference = referenceId ? findReference(referenceId) : null;
  const config = loadConfig(referenceId);

  const expectedOrigin =
    originOf(args.origin ?? '') ?? originOf(reference?.publicSources?.[0] ?? '') ?? null;

  const base = {
    REFERENCE: referenceId ?? '(none)',
    TARGET: expectedOrigin ?? '(any)',
    MODE: 'PREFLIGHT',
    ACCESS: reference?.accessPolicy ?? 'N/A',
  };

  let version;
  try {
    version = await cdpJson(config, '/json/version');
  } catch (err) {
    printCompact({
      ...base,
      STATUS: 'CDP_UNAVAILABLE',
      REASON: `${cdpBase(config)} unreachable: ${err.message}`,
      NEXT: 'pnpm ref:launch',
    });
    return EXIT.BLOCKED;
  }

  if (!version.Browser || !version.webSocketDebuggerUrl) {
    printCompact({
      ...base,
      STATUS: 'CDP_UNAVAILABLE',
      REASON: 'endpoint responded but does not represent a browser',
      NEXT: 'check whether another service occupies the configured port',
    });
    return EXIT.BLOCKED;
  }

  const targets = (await cdpJson(config, '/json/list')).filter((t) => t.type === 'page');

  if (!expectedOrigin) {
    printCompact({
      ...base,
      STATUS: 'READY',
      REASON: `${version.Browser}, ${targets.length} page target(s), no reference origin requested`,
    });
    return EXIT.SUCCESS;
  }

  const onOrigin = targets.filter((t) => originOf(t.url) === expectedOrigin);
  if (onOrigin.length === 0) {
    printCompact({
      ...base,
      STATUS: 'REFERENCE_TAB_NOT_FOUND',
      REASON: `${version.Browser} reachable, no page target on ${expectedOrigin}`,
      NEXT: `open ${expectedOrigin} in the reference browser`,
    });
    return EXIT.BLOCKED;
  }

  // Heuristic only: a login-shaped URL is treated as unauthenticated. Being wrong
  // in this direction is safe because it stops at the human boundary.
  const authWall = onOrigin.find((t) => LOGIN_HINT.test(t.url));
  if (authWall) {
    printCompact({
      ...base,
      STATUS: 'AUTH_REQUIRED',
      REASON: `reference session is on an authentication surface: ${authWall.url}`,
      NEXT: 'sign in manually in the reference browser, then re-run preflight',
    });
    return EXIT.AUTH_REQUIRED;
  }

  printCompact({
    ...base,
    STATUS:
      reference?.accessPolicy === 'AUTHENTICATED_ALLOWED'
        ? 'CDP_READY_AUTHENTICATED'
        : 'CDP_READY_NO_AUTH',
    REASON: `${version.Browser}, ${onOrigin.length} target(s) on ${expectedOrigin}`,
  });
  return EXIT.SUCCESS;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    printCompact({ STATUS: 'BLOCKED', MODE: 'PREFLIGHT', REASON: err.message });
    process.exit(EXIT.BLOCKED);
  },
);
