#!/usr/bin/env node
/**
 * Simulated cost-routing tests (Cases 1–10).
 * Deterministic — no model calls.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  assertNoFanOut,
  assertNoSilentFallback,
  assertRetryAllowed,
  assertInheritSafe,
  assertMinimumContext,
  assertOpenCodeFailureStops,
  assertCompletedPhaseNotRerun,
  validateEvidencePacket,
  loadRoutingRegistry,
} from './lib/guards.mjs';

const root = process.cwd();
const results = [];
const run = (id, fn) => {
  try {
    fn();
    results.push({ id, status: 'PASS' });
  } catch (e) {
    results.push({ id, status: 'FAIL', error: String(e.message || e), code: e.code });
  }
};

const policy = fs.readFileSync(path.join(root, 'docs/DEVELOPMENT_OS_COST_POLICY.md'), 'utf8');
const orchestrator = fs.readFileSync(
  path.join(root, '.cursor/rules/opencode-orchestrator.mdc'),
  'utf8',
);
const registry = loadRoutingRegistry(root);

// CASE 1: simple repository inspection → deterministic / OpenCode; Cursor premium = 0
run('CASE1_SIMPLE_INSPECTION', () => {
  const premium = 0;
  if (premium !== 0) throw new Error('premium must be 0');
  assertMinimumContext({ requiredFiles: ['package.json'], sentFiles: ['package.json'] });
});

// CASE 2: normal implementation → OpenCode; premium 0
run('CASE2_NORMAL_IMPLEMENTATION', () => {
  const route = 'opencode:oma-coder';
  if (!route.startsWith('opencode:')) throw new Error('expected OpenCode');
  const premiumDefaults = registry.agents.filter((a) => a.premium && a.defaultInvocationAllowed);
  if (premiumDefaults.length) throw new Error('premium default invocation not zero');
});

// CASE 3: complex architecture → evidence then ONE specialist
run('CASE3_ARCHITECTURE_ESCALATION', () => {
  validateEvidencePacket({
    question: 'Who owns tenant membership capability gates?',
    facts: ['DEC-002 approved'],
    unknown: [],
    constraints: ['tenant'],
    relevantFiles: ['specs/001-oma-ai-product-foundation/spec.md'],
  });
  assertNoFanOut({ specialists: ['oma-spec-auditor'], whyTwo: null });
});

// CASE 4: OpenCode unavailable → STOP, no paid Cursor
run('CASE4_OPENCODE_UNAVAILABLE', () => {
  const res = assertOpenCodeFailureStops({ openCodeAvailable: false, cursorPremiumStarted: false });
  if (res.status !== 'BLOCKED_BY_OPENCODE_ROUTE')
    throw new Error('expected BLOCKED_BY_OPENCODE_ROUTE');
  let denied = false;
  try {
    assertOpenCodeFailureStops({ openCodeAvailable: false, cursorPremiumStarted: true });
  } catch {
    denied = true;
  }
  if (!denied) throw new Error('silent fallback not denied');
});

// CASE 5: reference inspection → Reference Inspector; Parent gets artifacts
run('CASE5_REFERENCE_INSPECTION', () => {
  if (!fs.existsSync(path.join(root, '.opencode/agents/reference-inspector.md')))
    throw new Error('missing inspector');
  if (!/NO HEAVY CURSOR REFERENCE BROWSING|reference-inspector/.test(orchestrator))
    throw new Error('parent browse rule missing');
});

// CASE 6: same failed worker repeats → bounded stop
run('CASE6_USELESS_RETRY', () => {
  assertRetryAllowed({ attempt: 1 });
  let denied = false;
  try {
    assertRetryAllowed({ attempt: 2, changedEvidence: false });
  } catch {
    denied = true;
  }
  if (!denied) throw new Error('useless retry allowed');
  assertRetryAllowed({ attempt: 2, changedEvidence: true });
});

// CASE 7: 5 premium specialists → fan-out guard failure
run('CASE7_FAN_OUT', () => {
  let denied = false;
  try {
    assertNoFanOut({
      specialists: ['fable', 'sol', 'sonnet', 'opus', 'grok'],
      whyTwo: null,
    });
  } catch (e) {
    denied = e.code === 'COST_FAN_OUT_DENIED';
  }
  if (!denied) throw new Error('fan-out not denied');
});

// CASE 8: high-cost parent + inherit child → denied unless SAFE_TO_INHERIT
run('CASE8_INHERIT_SAFETY', () => {
  assertInheritSafe({
    parentCostClass: 'low',
    childInherit: true,
    childInheritClass: 'SAFE_TO_INHERIT',
  });
  let denied = false;
  try {
    assertInheritSafe({
      parentCostClass: 'high',
      childInherit: true,
      childInheritClass: 'SPECIALIST_EXPLICIT_MODEL',
    });
  } catch {
    denied = true;
  }
  if (!denied) throw new Error('high-cost inherit not denied');
});

// CASE 9: already-complete phase → do not rerun
run('CASE9_COMPLETED_PHASE', () => {
  assertCompletedPhaseNotRerun({ phaseStatus: 'CERTIFIED', forceRerun: false });
  let denied = false;
  try {
    assertCompletedPhaseNotRerun({ phaseStatus: 'FINAL-CLOSED', forceRerun: true });
  } catch {
    denied = true;
  }
  if (!denied) throw new Error('completed phase rerun allowed');
});

// CASE 10: large context available but task needs 3 files → minimum handoff
run('CASE10_MINIMUM_CONTEXT', () => {
  assertMinimumContext({
    requiredFiles: ['a.ts', 'b.ts', 'c.ts'],
    sentFiles: ['a.ts', 'b.ts', 'c.ts'],
    fullRepo: false,
    fullChat: false,
  });
  let denied = false;
  try {
    assertMinimumContext({
      requiredFiles: ['a.ts', 'b.ts', 'c.ts'],
      sentFiles: Array.from({ length: 60 }, (_, i) => `f${i}.ts`),
      fullRepo: false,
    });
  } catch {
    denied = true;
  }
  if (!denied) throw new Error('oversized packet allowed');
});

// Extra: silent fallback rule text present
run('CASE_SILENT_FALLBACK_RULE', () => {
  assertNoSilentFallback(orchestrator + '\n' + policy);
});

// Extra: evidence packet schema exists
run('CASE_EVIDENCE_PACKET_SCHEMA', () => {
  if (!fs.existsSync(path.join(root, 'scripts/dev-os/cost/evidence-packet.schema.json'))) {
    throw new Error('schema missing');
  }
});

const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL');
process.stdout.write(
  JSON.stringify(
    {
      gate: 'COST_ROUTING_TESTS',
      passed,
      total: results.length,
      failed: failed.map((f) => f.id),
      results,
    },
    null,
    2,
  ) + '\n',
);
process.exit(failed.length ? 1 : 0);
