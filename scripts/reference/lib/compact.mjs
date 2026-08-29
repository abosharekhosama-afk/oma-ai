import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir } from './config.mjs';

/**
 * Parent-facing output is deliberately small: the parent agent reads this, and
 * detail belongs in artifacts and the JSONL log.
 */
export function printCompact(fields) {
  const order = [
    'STATUS',
    'REFERENCE',
    'TARGET',
    'MODE',
    'ACCESS',
    'SURFACES',
    'ACTIONS',
    'ROLES',
    'JOURNEYS',
    'UNKNOWN',
    'ARTIFACTS',
    'BLOCKERS',
    'LOG',
    'REASON',
    'NEXT',
  ];
  for (const key of order) {
    if (fields[key] === undefined || fields[key] === null) continue;
    const value = Array.isArray(fields[key]) ? fields[key].join(', ') : String(fields[key]);
    process.stdout.write(`${key}: ${value}\n`);
  }
}

export function createLogger(logDir, name) {
  if (!logDir) {
    return { event: () => {}, path: null };
  }
  ensureDir(logDir);
  const path = join(logDir, `${name}.jsonl`);
  return {
    path,
    event(level, type, data = {}) {
      const line = JSON.stringify({ ts: new Date().toISOString(), level, type, ...data });
      appendFileSync(path, `${line}\n`);
    },
  };
}

export const EXIT = {
  SUCCESS: 0,
  BLOCKED: 1,
  USAGE: 2,
  AUTH_REQUIRED: 3,
};
