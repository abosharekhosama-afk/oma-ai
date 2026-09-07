#!/usr/bin/env node
/**
 * TOKEN_WASTE_AUDIT — permanent Development OS gate.
 * Evaluates policy files + optional stage ledger + optional usage CSV.
 * Never fabricates counts; uses NOT_OBSERVABLE when telemetry missing.
 *
 * usage:
 *   node scripts/dev-os/cost/token-waste-audit.mjs
 *   node scripts/dev-os/cost/token-waste-audit.mjs --ledger path.json --csv path.csv
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseUsageCsv, summarizeUsage } from './lib/usage.mjs';
import { assertNoFanOut, assertNoSilentFallback, loadRoutingRegistry } from './lib/guards.mjs';
import { resolveLedgerPath } from './lib/stages.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

const resolvedLedger = resolveLedgerPath({ cwd: root, explicit: get('--ledger') });
const ledgerPath = resolvedLedger.path;
const ledgerCapture = resolvedLedger.path ? 'AUTOMATIC_OR_EXPLICIT' : 'NOT_OBSERVABLE';
const csvPath =
  get('--csv') ||
  process.env.CURSOR_USAGE_CSV ||
  path.join(process.env.HOME || '', 'Downloads', 'usage-events-2026-09-06.csv');

const findings = [];
const note = (id, status, detail) => findings.push({ id, status, detail });

const policy = fs.existsSync(path.join(root, 'docs/DEVELOPMENT_OS_COST_POLICY.md'))
  ? fs.readFileSync(path.join(root, 'docs/DEVELOPMENT_OS_COST_POLICY.md'), 'utf8')
  : '';
const orchestrator = fs.existsSync(path.join(root, '.cursor/rules/opencode-orchestrator.mdc'))
  ? fs.readFileSync(path.join(root, '.cursor/rules/opencode-orchestrator.mdc'), 'utf8')
  : '';

note(
  'POLICY_PRESENT',
  policy.includes('TOKEN_WASTE_AUDIT') && policy.includes('NO_DUPLICATE_INTELLIGENCE')
    ? 'PASS'
    : 'FAIL',
  'docs/DEVELOPMENT_OS_COST_POLICY.md',
);
note(
  'ORCHESTRATOR_COST_HARDENING',
  /TOKEN_WASTE_AUDIT|NO_DUPLICATE_INTELLIGENCE|BLOCKED_BY_OPENCODE_ROUTE|WHY_TWO_SPECIALISTS_REQUIRED/.test(
    orchestrator,
  )
    ? 'PASS'
    : 'FAIL',
  '.cursor/rules/opencode-orchestrator.mdc',
);

let registry;
try {
  registry = loadRoutingRegistry(root);
  note(
    'ROUTING_REGISTRY',
    'PASS',
    `.cursor/agents/routing-registry.json (${registry.agents.length} agents)`,
  );
} catch (e) {
  note('ROUTING_REGISTRY', 'FAIL', String(e.message || e));
}

const premiumDefaults = (registry?.agents || []).filter(
  (a) => a.premium && a.defaultInvocationAllowed,
);
note(
  'PREMIUM_DEFAULT_ZERO',
  premiumDefaults.length === 0 ? 'PASS' : 'FAIL',
  premiumDefaults.length
    ? premiumDefaults.map((a) => a.id).join(',')
    : 'all premium defaultInvocationAllowed=false',
);

let unjustifiedPremium = 0;
let unjustifiedFanOut = 0;
let uselessRetries = 0;
let silentPaidFallback = 0;
let stageLedgerStatus = 'NOT_OBSERVABLE';

if (ledgerPath && fs.existsSync(ledgerPath)) {
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  stageLedgerStatus = 'OBSERVED';
  const specialists = ledger.cursorSpecialistCalls ?? ledger.specialists ?? [];
  if (specialists.length > 1 && !ledger.whyTwoSpecialistsRequired) {
    unjustifiedFanOut += 1;
    note(
      'A_OVERLAPPING_PREMIUM',
      'FAIL',
      `specialists=${specialists.length} without WHY_TWO_SPECIALISTS_REQUIRED`,
    );
  } else {
    note('A_OVERLAPPING_PREMIUM', 'PASS', `specialists=${specialists.length}`);
  }
  if ((ledger.cursorPremiumCalls ?? specialists.length) > 0 && !ledger.evidencePacket) {
    unjustifiedPremium += 1;
    note('B_CONTEXT', 'FAIL', 'premium call without evidencePacket');
  } else {
    note('B_CONTEXT', 'PASS', ledger.evidencePacket ? 'packet present' : 'no premium');
  }
  if (ledger.fullRepoSent === true || ledger.fullChatHistorySent === true) {
    note('C_FULL_HISTORY', 'FAIL', 'full context flagged in ledger');
  } else {
    note('C_FULL_HISTORY', 'PASS', 'not flagged');
  }
  if (ledger.deterministicViaModel === true) {
    note('D_DETERMINISTIC_VIA_MODEL', 'FAIL', 'deterministic work routed through model');
  } else {
    note('D_DETERMINISTIC_VIA_MODEL', 'PASS', 'ok');
  }
  const retries = ledger.uselessRetries ?? 0;
  uselessRetries += retries;
  note('E_USELESS_RETRIES', retries === 0 ? 'PASS' : 'FAIL', `uselessRetries=${retries}`);
  if (ledger.silentPaidFallback === true || ledger.openCodeFailedThenCursorPremium === true) {
    silentPaidFallback += 1;
    note('F_SILENT_FALLBACK', 'FAIL', 'silent OpenCode→Cursor fallback recorded');
  } else {
    note('F_SILENT_FALLBACK', 'PASS', 'denied/not recorded');
  }
  note(
    'G_REFERENCE_REINSPECT',
    ledger.unnecessaryReferenceReinspect ? 'FAIL' : 'PASS',
    ledger.unnecessaryReferenceReinspect ? 'reinspect flagged' : 'ok/not flagged',
  );
  note(
    'H_MULTI_REVIEWER',
    specialists.length > 1 && !ledger.whyTwoSpecialistsRequired ? 'FAIL' : 'PASS',
    'see A',
  );
  note(
    'I_INHERIT_CHAIN',
    ledger.highCostInheritChain ? 'FAIL' : 'PASS',
    ledger.highCostInheritChain ? 'flagged' : 'ok/not flagged',
  );
  note(
    'J_EXCESS_SPECIALISTS',
    (ledger.cursorSpecialistCalls?.length ?? specialists.length) > 1 &&
      !ledger.whyTwoSpecialistsRequired
      ? 'FAIL'
      : 'PASS',
    'per-stage total',
  );
  note('K_RERUN_COMPLETE', ledger.reranCompletedStage ? 'FAIL' : 'PASS', 'ok/not flagged');
  note('L_WHOLESALE_REPORT', ledger.wholesaleReportReplay ? 'FAIL' : 'PASS', 'ok/not flagged');
} else {
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach((letter) => {
    note(
      `${letter}_STAGE`,
      'NOT_OBSERVABLE',
      `no stage ledger (${resolvedLedger.source}); run via dev-os:stage for substantial work`,
    );
  });
}

let usageStatus = 'NOT_OBSERVABLE';
if (csvPath && fs.existsSync(csvPath)) {
  usageStatus = 'OBSERVED';
  const summary = summarizeUsage(parseUsageCsv(csvPath));
  note(
    'USAGE_FAN_OUT_HISTORY',
    summary.findings.historicalModelFanOut,
    `fanOutMinutesGe3=${summary.fanOutMinutesGe3}`,
  );
  note(
    'USAGE_CACHE_AMPLIFICATION',
    summary.cacheReadSharePct >= 70 ? 'COST_WARNING_CACHE_AMPLIFICATION' : 'PASS',
    `cacheReadShare=${summary.cacheReadSharePct}%`,
  );
  note(
    'USAGE_SILENT_FALLBACK',
    summary.findings.silentOpenCodeToCursorFallback,
    'cannot prove from CSV alone',
  );
} else {
  note('USAGE_EXPORT', 'NOT_OBSERVABLE', 'CSV missing');
}

// Static policy assertions always run
try {
  assertNoSilentFallback(orchestrator + '\n' + policy);
  note('STATIC_SILENT_FALLBACK_RULE', 'PASS', 'DENY documented');
} catch (e) {
  note('STATIC_SILENT_FALLBACK_RULE', 'FAIL', String(e.message || e));
  silentPaidFallback += 1;
}
try {
  assertNoFanOut({ specialists: ['a', 'b'], whyTwo: null });
  note('STATIC_FAN_OUT_GUARD', 'FAIL', 'guard failed to deny');
  unjustifiedFanOut += 1;
} catch {
  note('STATIC_FAN_OUT_GUARD', 'PASS', 'denies multi-specialist without why');
}

const hardFails = findings.filter((f) => f.status === 'FAIL');
const gatePass =
  hardFails.length === 0 &&
  unjustifiedPremium === 0 &&
  unjustifiedFanOut === 0 &&
  uselessRetries === 0 &&
  silentPaidFallback === 0;

const result = {
  gate: 'TOKEN_WASTE_AUDIT',
  status: gatePass ? 'PASS' : 'FAIL',
  unjustifiedPremiumCalls: unjustifiedPremium,
  unjustifiedModelFanOut: unjustifiedFanOut,
  uselessRetries,
  silentPaidFallback,
  stageLedgerStatus,
  usageStatus,
  ledgerCapture,
  ledgerSource: resolvedLedger.source,
  ledgerPath: ledgerPath || null,
  telemetryValues: stageLedgerStatus === 'OBSERVED' ? 'PARTIAL_OR_EXACT' : 'NOT_OBSERVABLE',
  findings,
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exit(gatePass ? 0 : 1);
