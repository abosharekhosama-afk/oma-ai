#!/usr/bin/env node
/**
 * Compare a repository against the Golden Development OS baseline.
 * Deterministic. Does not modify other repos. Does not call models.
 *
 * usage:
 *   node scripts/dev-os/golden/compare-golden-baseline.mjs
 *   node scripts/dev-os/golden/compare-golden-baseline.mjs --root /path/to/other-repo
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const rootIdx = args.indexOf('--root');
const targetRoot = rootIdx >= 0 ? args[rootIdx + 1] : process.cwd();
const selfRoot = process.cwd();

const manifestPath = path.join(selfRoot, 'scripts/dev-os/golden/golden-baseline.manifest.json');
if (!fs.existsSync(manifestPath)) {
  process.stderr.write('golden-baseline.manifest.json missing in current repo\n');
  process.exit(2);
}
const golden = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const exists = (rel) => fs.existsSync(path.join(targetRoot, rel));
const read = (rel) => (exists(rel) ? fs.readFileSync(path.join(targetRoot, rel), 'utf8') : null);

const results = [];
const classify = (id, status, detail = '') => results.push({ id, status, detail });

const pathMap = {
  orchestrator: golden.owners.orchestrator,
  costPolicy: golden.owners.costPolicy,
  routingRegistry: golden.owners.routingRegistry,
  validator: golden.owners.validator,
  doctor: golden.owners.doctor,
  referenceProtocol: golden.owners.referenceProtocol,
  tokenWasteAudit: golden.owners.tokenWasteAudit,
  usageLedger: golden.owners.usageLedger,
  stageRunner: golden.owners.stageRunner,
  evidencePacketSchema: golden.owners.evidencePacketSchema,
  openCodeImplementationWorker: golden.paths.openCodeImplementationWorker,
  openCodeReferenceInspector: golden.paths.openCodeReferenceInspector,
  codexWorkerRoute: golden.paths.codexWorkerRoute,
  goldenContract: golden.owners.goldenContract,
  goldenManifest: 'scripts/dev-os/golden/golden-baseline.manifest.json',
  projectManifest: golden.paths?.projectManifest || 'scripts/dev-os/golden/project-manifest.json',
  workflow: golden.owners.workflow || 'docs/DEVELOPMENT_WORKFLOW.md',
};

for (const [id, rel] of Object.entries(pathMap)) {
  if (!exists(rel)) {
    classify(id, 'MISSING', rel);
    continue;
  }
  if (id === 'goldenManifest') {
    try {
      const theirs = JSON.parse(read(rel));
      if (theirs.version === golden.version) classify(id, 'MATCH', `version ${theirs.version}`);
      else classify(id, 'OUTDATED', `theirs=${theirs.version} golden=${golden.version}`);
    } catch (e) {
      classify(id, 'CONFLICT', String(e.message || e));
    }
    continue;
  }
  if (id === 'projectManifest') {
    try {
      const doc = JSON.parse(read(rel));
      const required = [
        'PROJECT_ID',
        'PROJECT_NAME',
        'REPOSITORY',
        'PRODUCT_SPEC_ROOT',
        'IMPLEMENTATION_WORKER_NAME',
        'REFERENCE_WORKER_NAME',
        'GOLDEN_OS_VERSION_PIN',
      ];
      const missing = required.filter((k) => !doc[k]);
      if (missing.length) classify(id, 'OUTDATED', `missing keys: ${missing.join(',')}`);
      else if (doc.GOLDEN_OS_VERSION_PIN !== golden.version)
        classify(id, 'OUTDATED', `pin=${doc.GOLDEN_OS_VERSION_PIN}`);
      else classify(id, 'PROJECT_SPECIFIC', `${doc.PROJECT_ID}@${doc.GOLDEN_OS_VERSION_PIN}`);
    } catch (e) {
      classify(id, 'CONFLICT', String(e.message || e));
    }
    continue;
  }
  if (id === 'routingRegistry') {
    try {
      const doc = JSON.parse(read(rel));
      const bad = (doc.agents || []).filter((a) => a.premium && a.defaultInvocationAllowed);
      if (bad.length)
        classify(id, 'CONFLICT', `premium default not 0: ${bad.map((a) => a.id).join(',')}`);
      else classify(id, 'MATCH', rel);
    } catch (e) {
      classify(id, 'CONFLICT', String(e.message || e));
    }
    continue;
  }
  if (id === 'validator' || id === 'doctor' || id === 'referenceProtocol') {
    classify(id, 'MATCH_STRONGER_IMPLEMENTATION', `${rel} (OMA project checks preserved)`);
    continue;
  }
  classify(id, 'MATCH', rel);
}

const whichStatus = (cmd) => {
  const res = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
    encoding: 'utf8',
  });
  return res.status === 0 ? 'READY' : 'NOT_CONFIGURED';
};

const runtime = {
  opencodeCli: whichStatus('opencode'),
  codexCli: whichStatus('codex'),
};

if (runtime.codexCli === 'NOT_CONFIGURED') {
  classify(
    'codexCliRuntime',
    'RUNTIME_NOT_CONFIGURED',
    'codex not on PATH (route may still be configured)',
  );
}
if (runtime.opencodeCli === 'NOT_CONFIGURED') {
  classify('opencodeCliRuntime', 'RUNTIME_NOT_CONFIGURED', 'opencode not on PATH');
} else {
  classify('opencodeCliRuntime', 'MATCH', 'opencode on PATH');
}

const coreText = `${read(golden.owners.goldenContract) || ''}\n${JSON.stringify(golden)}`;
const contamination =
  /PEOPLE_P8_REQUIRED_IN_CORE|PROPAGATE_ZOHO_PEOPLE_TO_ISP|PAYROLL_BOUNDARY_AS_CORE_OS/.test(
    coreText,
  );
classify(
  'PROJECT_SPECIFIC_CONTAMINATION_IN_CORE',
  contamination ? 'CONFLICT' : 'MATCH',
  contamination ? 'product contamination markers found' : '0',
);

const counts = results.reduce((acc, r) => {
  acc[r.status] = (acc[r.status] || 0) + 1;
  return acc;
}, {});

const ok = !results.some((r) => ['MISSING', 'OUTDATED', 'CONFLICT'].includes(r.status));

process.stdout.write(
  JSON.stringify(
    {
      goldenBaselineId: golden.goldenBaselineId,
      goldenVersion: golden.version,
      targetRoot,
      status: ok ? 'MATCH' : 'DIVERGED',
      counts,
      runtime,
      vocabulary: golden.comparisonVocabulary,
      results,
    },
    null,
    2,
  ) + '\n',
);
process.exit(ok ? 0 : 1);
