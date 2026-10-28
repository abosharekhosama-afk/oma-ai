#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.cwd(), 'apps/api/src');
const forbidden = [
  { name: '$queryRawUnsafe', pattern: /\$queryRawUnsafe\b/g },
  { name: '$executeRawUnsafe', pattern: /\$executeRawUnsafe\b/g },
  { name: 'Prisma.raw', pattern: /\bPrisma\.raw\s*\(/g },
  { name: '$runCommandRaw', pattern: /\$runCommandRaw\b/g },
];
const violations = [];

async function visit(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    console.error(`Cannot scan production API source at ${directory}: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(file);
    } else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
      const contents = await readFile(file, 'utf8');
      for (const rule of forbidden) {
        for (const match of contents.matchAll(rule.pattern)) {
          const line = contents.slice(0, match.index).split('\n').length;
          violations.push(`${path.relative(process.cwd(), file)}:${line}: ${rule.name}`);
        }
      }
    }
  }
}

await visit(root);
if (violations.length) {
  console.error('Unsafe raw SQL APIs are forbidden in production API source:');
  for (const violation of violations) console.error(`  ${violation}`);
  process.exitCode = 1;
} else if (process.exitCode !== 2) {
  console.log('SQL safety scan passed: no unsafe raw SQL APIs in apps/api/src.');
}
