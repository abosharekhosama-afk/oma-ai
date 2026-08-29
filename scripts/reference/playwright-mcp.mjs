#!/usr/bin/env node
/**
 * Launches Playwright MCP against the canonical reference CDP endpoint.
 *
 * This wrapper exists so the MCP configuration does not carry its own copy of
 * the endpoint: a static JSON config cannot resolve
 * .reference/reference-config.default.json, and a second literal port is
 * exactly the drift this subsystem is meant to prevent.
 */
import { spawn } from 'node:child_process';
import { resolveCdpEndpoint } from './lib/config.mjs';

let resolved;
try {
  resolved = resolveCdpEndpoint(process.env.OMA_REFERENCE_ID ?? null);
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}

const child = spawn(
  'npx',
  ['-y', '@playwright/mcp@latest', '--cdp-endpoint', resolved.endpoint, ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
child.on('exit', (code) => process.exit(code ?? 1));
