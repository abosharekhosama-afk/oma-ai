import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const REFERENCE_ROOT = join(REPO_ROOT, '.reference');

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadRegistry() {
  const path = join(REFERENCE_ROOT, 'registry.json');
  if (!existsSync(path)) {
    throw new Error('missing .reference/registry.json');
  }
  return readJson(path);
}

export function findReference(referenceId) {
  const registry = loadRegistry();
  const entry = registry.references.find((r) => r.referenceId === referenceId);
  if (!entry) {
    const known = registry.references.map((r) => r.referenceId).join(', ');
    throw new Error(`unknown reference "${referenceId}". Known: ${known}`);
  }
  return entry;
}

/**
 * Defaults, then per-reference overrides, then environment. Environment is last
 * so a developer can retarget a port without editing committed config.
 */
export function loadConfig(referenceId) {
  const defaults = readJson(join(REFERENCE_ROOT, 'reference-config.default.json'));
  const overridePath = referenceId
    ? join(REFERENCE_ROOT, referenceId, 'reference-config.json')
    : null;
  const override = overridePath && existsSync(overridePath) ? readJson(overridePath) : {};

  const merged = {
    ...defaults,
    ...override,
    cdp: { ...defaults.cdp, ...(override.cdp ?? {}) },
    viewport: { ...defaults.viewport, ...(override.viewport ?? {}) },
    worker: { ...defaults.worker, ...(override.worker ?? {}) },
  };

  if (process.env.OMA_REFERENCE_CDP_PORT) {
    merged.cdp.port = Number(process.env.OMA_REFERENCE_CDP_PORT);
  }
  if (process.env.OMA_REFERENCE_PROFILE_DIR) {
    merged.profileDir = process.env.OMA_REFERENCE_PROFILE_DIR;
  }

  // Loopback is a security boundary, not a preference.
  if (merged.cdp.host !== '127.0.0.1' && merged.cdp.host !== 'localhost') {
    throw new Error(`reference CDP host must be loopback, got "${merged.cdp.host}"`);
  }

  merged.referenceId = referenceId ?? null;
  merged.profileDirAbsolute = resolve(REPO_ROOT, merged.profileDir);
  if (referenceId) {
    merged.artifactPathAbsolute = resolve(
      REPO_ROOT,
      merged.artifactPath.replace('{referenceId}', referenceId),
    );
    merged.logPathAbsolute = resolve(
      REPO_ROOT,
      merged.logPath.replace('{referenceId}', referenceId),
    );
  }
  return merged;
}

export function cdpBase(config) {
  return `http://${config.cdp.host}:${config.cdp.port}`;
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq > -1) {
        out[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          out[arg.slice(2)] = next;
          i += 1;
        } else {
          out[arg.slice(2)] = true;
        }
      }
    } else {
      out._.push(arg);
    }
  }
  return out;
}
