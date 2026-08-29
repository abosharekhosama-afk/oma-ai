#!/usr/bin/env node
/**
 * Builds our application's navigation map by reading the Next.js App Router
 * tree, so reference comparison is never made against recollection of what we
 * built.
 */
import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REFERENCE_ROOT, REPO_ROOT, ensureDir } from './lib/config.mjs';
import { EXIT, printCompact } from './lib/compact.mjs';

const APP_DIR = join(REPO_ROOT, 'apps/web/src/app');
const PAGE_FILES = new Set(['page.tsx', 'page.ts', 'page.jsx', 'page.js']);

/** Route groups such as (app) exist for layout only and carry no URL segment. */
function toRoute(dirRelative) {
  const segments = dirRelative
    .split('/')
    .filter((s) => s && !(s.startsWith('(') && s.endsWith(')')));
  return `/${segments.join('/')}` === '/' ? '/' : `/${segments.join('/')}`;
}

function surfaceType(route) {
  if (route === '/') return 'PUBLIC_LANDING';
  if (/^\/(login|register)/.test(route)) return 'AUTH';
  if (route.includes('[')) return 'DETAIL';
  return 'PAGE';
}

function walk(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, found);
    } else if (PAGE_FILES.has(entry)) {
      found.push(relative(APP_DIR, dir));
    }
  }
  return found;
}

function main() {
  if (!existsSync(APP_DIR)) {
    printCompact({
      STATUS: 'BLOCKED',
      MODE: 'OUR_NAVIGATION',
      REASON: `no App Router directory at ${relative(REPO_ROOT, APP_DIR)}`,
    });
    return EXIT.BLOCKED;
  }

  const routes = [...new Set(walk(APP_DIR).map(toRoute))].sort();
  const nodes = routes.map((route) => {
    const parentRoute = route === '/' ? null : route.split('/').slice(0, -1).join('/') || '/';
    return {
      id: route,
      parentId: routes.includes(parentRoute) ? parentRoute : null,
      route,
      label: route === '/' ? 'Public landing' : route.split('/').filter(Boolean).pop(),
      surfaceType: surfaceType(route),
      dynamicSegments: (route.match(/\[[^\]]+\]/g) ?? []).map((s) => s.slice(1, -1)),
    };
  });

  const outDir = ensureDir(join(REFERENCE_ROOT, '_ours'));
  const outPath = join(outDir, 'our-navigation-map.json');
  writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        meta: {
          project: 'oma-ai',
          generatedAt: new Date().toISOString(),
          source: relative(REPO_ROOT, APP_DIR),
          generator: 'scripts/reference/build-our-navigation-map.mjs',
        },
        nodes,
      },
      null,
      2,
    )}\n`,
  );

  printCompact({
    STATUS: 'SUCCESS',
    MODE: 'OUR_NAVIGATION',
    SURFACES: nodes.length,
    ARTIFACTS: relative(REPO_ROOT, outPath),
  });
  return EXIT.SUCCESS;
}

process.exit(main());
