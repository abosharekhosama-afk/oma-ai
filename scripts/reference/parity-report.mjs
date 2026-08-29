#!/usr/bin/env node
/**
 * Derives coverage metrics and human-readable documents strictly from artifacts
 * on disk. Every number here is a count of recorded rows; nothing is estimated,
 * inferred, or recalled.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  REFERENCE_ROOT,
  REPO_ROOT,
  ensureDir,
  findReference,
  parseArgs,
  readJson,
} from './lib/config.mjs';
import { EXIT, printCompact } from './lib/compact.mjs';

const SCHEMAS = readJson(join(REFERENCE_ROOT, '_schema/schemas.json'));
const PARITY_STATUSES = SCHEMAS.vocabularies.parityStatus;
const RESOLVED = new Set([
  'MATCH',
  'INTENTIONAL_DIFFERENCE',
  'REFERENCE_LIMITED',
  'NOT_APPLICABLE',
]);

function load(dir, kind) {
  const path = join(dir, `${kind}.json`);
  return existsSync(path) ? readJson(path) : null;
}

function navigationTree(nodes) {
  const byParent = new Map();
  for (const node of nodes) {
    const key = node.parentId ?? '__root__';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(node);
  }
  const lines = [];
  const render = (parentKey, prefix) => {
    const children = byParent.get(parentKey) ?? [];
    children.forEach((node, index) => {
      const last = index === children.length - 1;
      const label = node.label ?? node.id;
      const status = node.inspectionStatus ? ` — ${node.inspectionStatus}` : '';
      lines.push(`${prefix}${last ? '└── ' : '├── '}${label}${status}`);
      render(node.id, `${prefix}${last ? '    ' : '│   '}`);
    });
  };
  render('__root__', '');
  return lines;
}

function navigationDiff(referenceNodes, ourNodes) {
  const norm = (value) =>
    (value ?? '')
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  const ourByKey = new Map(ourNodes.map((n) => [norm(n.route), n]));
  const ourByLabel = new Map(ourNodes.map((n) => [norm(n.label), n]));
  const rows = [];
  const matchedOurs = new Set();

  for (const node of referenceNodes) {
    const byRoute = node.route ? ourByKey.get(norm(node.route)) : undefined;
    const byLabel = ourByLabel.get(norm(node.label));
    const match = byRoute ?? byLabel;
    if (match) {
      matchedOurs.add(match.id);
      rows.push({
        reference: node.label ?? node.id,
        ours: match.route,
        classification: byRoute ? 'MATCHED_PATH' : 'PARTIAL_PATH',
      });
    } else {
      rows.push({ reference: node.label ?? node.id, ours: null, classification: 'REFERENCE_ONLY' });
    }
  }
  for (const node of ourNodes) {
    if (!matchedOurs.has(node.id)) {
      rows.push({ reference: null, ours: node.route, classification: 'OURS_ONLY' });
    }
  }
  return rows;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.reference) {
    printCompact({
      STATUS: 'BLOCKED',
      MODE: 'PARITY_REPORT',
      REASON: 'usage: pnpm ref:parity --reference <id>',
    });
    return EXIT.USAGE;
  }

  const reference = findReference(args.reference);
  const dir = join(REFERENCE_ROOT, args.reference);
  if (!existsSync(dir)) {
    printCompact({
      STATUS: 'BLOCKED',
      MODE: 'PARITY_REPORT',
      REFERENCE: args.reference,
      REASON: `no evidence directory at ${relative(REPO_ROOT, dir)}; run an inspection first`,
    });
    return EXIT.BLOCKED;
  }

  const navigation = load(dir, 'navigation-map');
  const surfaces = load(dir, 'surface-inventory');
  const actions = load(dir, 'action-inventory');
  const roles = load(dir, 'role-permission-matrix');
  const journeys = load(dir, 'journey-catalog');
  const parity = load(dir, 'parity-matrix');
  const unknowns = load(dir, 'unknowns');
  const ourNav = load(join(REFERENCE_ROOT, '_ours'), 'our-navigation-map');

  const parityRows = parity?.rows ?? [];
  const byStatus = Object.fromEntries(
    PARITY_STATUSES.map((status) => [status, parityRows.filter((r) => r.status === status).length]),
  );
  const unclassified = parityRows.filter((r) => !PARITY_STATUSES.includes(r.status)).length;
  const referenceSurfaces = surfaces?.surfaces ?? [];
  const comparedIds = new Set(parityRows.map((r) => r.referenceId));
  const uncompared = referenceSurfaces.filter((s) => !comparedIds.has(s.surfaceId)).length;

  // The strongest honest claim, and only when nothing accessible is left open.
  const coverageClaim =
    parityRows.length > 0 && unclassified === 0 && uncompared === 0
      ? parityRows.every((r) => RESOLVED.has(r.status))
        ? '100_PERCENT_OF_VERIFIED_ACCESSIBLE_REFERENCE_SURFACE_RECONCILED'
        : 'RECONCILED_WITH_OPEN_GAPS'
      : 'INCOMPLETE_COVERAGE';

  const counts = {
    referenceSurfacesInspected: referenceSurfaces.length,
    referenceActionsInventoried: actions?.actions?.length ?? 0,
    referenceRolesCovered: roles?.roles?.length ?? 0,
    referenceJourneysCovered: journeys?.journeys?.length ?? 0,
    navigationNodes: navigation?.nodes?.length ?? 0,
    ourNavigationNodes: ourNav?.nodes?.length ?? 0,
    parityRows: parityRows.length,
    parityByStatus: byStatus,
    unclassifiedParityRows: unclassified,
    inspectedSurfacesWithoutParityRow: uncompared,
    unknowns: unknowns?.unknowns?.length ?? 0,
    blockingUnknowns: (unknowns?.unknowns ?? []).filter((u) => u.blocking === true).length,
  };

  const summaryPath = join(dir, 'coverage-summary.json');
  writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        meta: {
          referenceId: args.reference,
          generatedAt: new Date().toISOString(),
          coverageClaim,
          accessPolicy: reference.accessPolicy,
          authority: reference.authority,
          generator: 'scripts/reference/parity-report.mjs',
        },
        counts,
      },
      null,
      2,
    )}\n`,
  );

  const docsDir = ensureDir(join(dir, 'docs'));
  const navDiff = navigation && ourNav ? navigationDiff(navigation.nodes, ourNav.nodes) : [];

  writeFileSync(
    join(docsDir, 'REFERENCE_NAVIGATION.md'),
    [
      `# ${reference.name} — reference navigation`,
      '',
      `Generated from \`${relative(REPO_ROOT, dir)}/navigation-map.json\`. Do not edit by hand.`,
      '',
      `Access policy: \`${reference.accessPolicy}\`. Authority: ${reference.authority.join(', ')}.`,
      '',
      '## Reference tree',
      '',
      navigation
        ? ['```', reference.name, ...navigationTree(navigation.nodes), '```'].join('\n')
        : '_No navigation map captured yet._',
      '',
      '## Navigation difference against our application',
      '',
      navDiff.length
        ? [
            '| Reference | Ours | Classification |',
            '| --- | --- | --- |',
            ...navDiff.map(
              (r) => `| ${r.reference ?? '—'} | ${r.ours ?? '—'} | \`${r.classification}\` |`,
            ),
          ].join('\n')
        : '_Requires both a reference navigation map and `pnpm ref:our-nav`._',
      '',
    ].join('\n'),
  );

  const remaining = [];
  if (counts.unclassifiedParityRows > 0) {
    remaining.push(
      `- ${counts.unclassifiedParityRows} parity row(s) carry a status outside the allowed vocabulary.`,
    );
  }
  if (counts.inspectedSurfacesWithoutParityRow > 0) {
    remaining.push(
      `- ${counts.inspectedSurfacesWithoutParityRow} inspected surface(s) have not been compared to our implementation. Unclassified accessible functionality is a blocker.`,
    );
  }
  if (counts.blockingUnknowns > 0) {
    remaining.push(
      `- ${counts.blockingUnknowns} blocking unknown(s) must be resolved before implementation.`,
    );
  }
  for (const status of [
    'MISSING',
    'PARTIAL',
    'WRONG_EXISTING_IMPLEMENTATION',
    'REBUILD',
    'RECONNECT',
    'REMOVE',
  ]) {
    if (byStatus[status] > 0) {
      remaining.push(`- ${byStatus[status]} row(s) classified \`${status}\`.`);
    }
  }
  if (counts.parityRows === 0) {
    remaining.push('- No parity comparison exists yet.');
  }
  if (remaining.length === 0) {
    remaining.push(
      '- Nothing outstanding in the declared scope. Reference-limited areas remain unverifiable rather than resolved.',
    );
  }

  writeFileSync(
    join(docsDir, 'REFERENCE_COVERAGE.md'),
    [
      `# ${reference.name} — reference coverage`,
      '',
      `Generated from artifacts in \`${relative(REPO_ROOT, dir)}\`. Do not edit by hand.`,
      '',
      `**Coverage claim:** \`${coverageClaim}\``,
      '',
      '| Metric | Count |',
      '| --- | --- |',
      `| Reference surfaces inspected | ${counts.referenceSurfacesInspected} |`,
      `| Reference actions inventoried | ${counts.referenceActionsInventoried} |`,
      `| Roles covered | ${counts.referenceRolesCovered} |`,
      `| Journeys covered | ${counts.referenceJourneysCovered} |`,
      `| Reference navigation nodes | ${counts.navigationNodes} |`,
      `| Our navigation nodes | ${counts.ourNavigationNodes} |`,
      `| Parity rows | ${counts.parityRows} |`,
      `| Inspected surfaces with no parity row | ${counts.inspectedSurfacesWithoutParityRow} |`,
      `| Unclassified parity rows | ${counts.unclassifiedParityRows} |`,
      `| Unknowns | ${counts.unknowns} (blocking: ${counts.blockingUnknowns}) |`,
      '',
      '## Parity by status',
      '',
      '| Status | Count |',
      '| --- | --- |',
      ...PARITY_STATUSES.map((status) => `| \`${status}\` | ${byStatus[status]} |`),
      '',
      '## What remains',
      '',
      ...remaining,
      '',
    ].join('\n'),
  );

  printCompact({
    STATUS: 'SUCCESS',
    MODE: 'PARITY_REPORT',
    REFERENCE: args.reference,
    SURFACES: counts.referenceSurfacesInspected,
    ACTIONS: counts.referenceActionsInventoried,
    ROLES: counts.referenceRolesCovered,
    JOURNEYS: counts.referenceJourneysCovered,
    UNKNOWN: counts.unknowns,
    ARTIFACTS: [
      relative(REPO_ROOT, summaryPath),
      relative(REPO_ROOT, join(docsDir, 'REFERENCE_NAVIGATION.md')),
      relative(REPO_ROOT, join(docsDir, 'REFERENCE_COVERAGE.md')),
    ],
    REASON: `coverage claim ${coverageClaim}`,
  });
  return EXIT.SUCCESS;
}

process.exit(main());
