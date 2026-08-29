#!/usr/bin/env node
/**
 * Deterministic invariant check for the Development OS. It verifies that the
 * governance mechanisms and role boundaries are still present and still say what
 * they must say, so this subsystem cannot quietly weaken the existing OS.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function read(path) {
  const full = join(REPO_ROOT, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : null;
}

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
}

function fileHas(path, pattern, name, detail) {
  const content = read(path);
  if (content === null) return check(name, false, `${path} missing`);
  return check(name, pattern.test(content), detail ?? `${path} must state this invariant`);
}

// Existing Development OS must survive.
check(
  'cursor-orchestrator-rule',
  read('.cursor/rules/oma-orchestrator.mdc') !== null,
  '.cursor/rules/oma-orchestrator.mdc',
);
check('agents-contract', read('AGENTS.md') !== null, 'AGENTS.md');
check(
  'constitution',
  read('.specify/memory/constitution.md') !== null,
  '.specify/memory/constitution.md',
);
check(
  'spec-kit-active',
  existsSync(join(REPO_ROOT, '.specify/workflows/workflow-registry.json')),
  '.specify workflows',
);
check(
  'spec-auditor',
  read('.cursor/agents/oma-spec-auditor.md') !== null,
  '.cursor/agents/oma-spec-auditor.md',
);
check(
  'verifier',
  read('.cursor/agents/oma-verifier.md') !== null,
  '.cursor/agents/oma-verifier.md',
);
check(
  'skill-spec-first',
  read('.agents/skills/oma-spec-first/SKILL.md') !== null,
  'spec-first skill',
);
check(
  'skill-deliver-change',
  read('.agents/skills/oma-deliver-change/SKILL.md') !== null,
  'deliver-change skill',
);
check(
  'skill-verify-change',
  read('.agents/skills/oma-verify-change/SKILL.md') !== null,
  'verify-change skill',
);
check(
  'application-e2e-separate',
  existsSync(join(REPO_ROOT, 'playwright.config.ts')) && existsSync(join(REPO_ROOT, 'tests/e2e')),
  'playwright.config.ts + tests/e2e',
);

fileHas(
  'docs/CURSOR_WORKFLOW.md',
  /OpenCode/i,
  'opencode-implementation-route',
  'implementation-worker route must remain documented',
);
fileHas('docs/CURSOR_WORKFLOW.md', /Codex/i, 'codex-route', 'Codex route must remain documented');
fileHas('docs/CURSOR_WORKFLOW.md', /False-completion audit/i, 'false-completion-audit');
fileHas('docs/CURSOR_WORKFLOW.md', /Converge/i, 'convergence');
fileHas('docs/CURSOR_WORKFLOW.md', /do not hard-pin a premium model/i, 'premium-default-zero');
fileHas('docs/CURSOR_WORKFLOW.md', /Gate|blocker decisions/i, 'blocker-gate');
fileHas('docs/CURSOR_WORKFLOW.md', /Map.*domain owner|storage owner/i, 'sot-map');
fileHas(
  'docs/CURSOR_WORKFLOW.md',
  /thin orchestrator that routes only the context/i,
  'context-router',
);

// Reference intelligence subsystem.
const protocol = 'docs/REFERENCE_PARITY_PROTOCOL.md';
check('reference-protocol-canonical', read(protocol) !== null, protocol);
fileHas(protocol, /read-only access to application source/i, 'inspector-read-only-policy');
fileHas(protocol, /AUTH_REQUIRED/, 'auth-boundary');
fileHas(protocol, /127\.0\.0\.1/, 'cdp-loopback-only');
fileHas(
  protocol,
  /`--dangerously-skip-permissions` is \*\*not\*\* adopted/,
  'no-unrestricted-permission-bypass',
);
fileHas(
  protocol,
  /100_PERCENT_OF_VERIFIED_ACCESSIBLE_REFERENCE_SURFACE_RECONCILED/,
  'coverage-claim-rule',
);
fileHas(
  protocol,
  /REFERENCE_EVIDENCE_INSUFFICIENT/,
  'coding-worker-cannot-invent-reference-behavior',
);
fileHas(
  protocol,
  /Reference inspection is not proof our implementation works/,
  'reference-vs-e2e-separation',
);
fileHas(protocol, /never from memory/i, 'no-answers-from-memory');

check(
  'reference-inspector-agent',
  read('.opencode/agents/reference-inspector.md') !== null,
  '.opencode/agents/reference-inspector.md',
);
fileHas(
  '.opencode/agents/reference-inspector.md',
  /must not[\s\S]{0,300}modify application code/i,
  'inspector-agent-read-only',
);
fileHas(
  '.cursor/rules/oma-orchestrator.mdc',
  /browser-heavy external-reference/i,
  'cursor-rule-forbids-browser-heavy-reference-work',
);

check('reference-registry', read('.reference/registry.json') !== null, '.reference/registry.json');
check(
  'artifact-schemas',
  read('.reference/_schema/schemas.json') !== null,
  '.reference/_schema/schemas.json',
);
check(
  'cdp-preflight',
  read('scripts/reference/cdp-preflight.mjs') !== null,
  'scripts/reference/cdp-preflight.mjs',
);
check(
  'cross-platform-launcher',
  read('scripts/reference/launch-reference-browser.mjs') !== null,
  'launcher',
);
check('worker-smoke', read('scripts/reference/reference-worker-smoke.mjs') !== null, 'smoke');
check(
  'artifact-validator',
  read('scripts/reference/validate-reference-artifacts.mjs') !== null,
  'validator',
);
check(
  'inspection-orchestrator',
  read('scripts/reference/inspect-reference.mjs') !== null,
  'orchestrator',
);
check('parity-report', read('scripts/reference/parity-report.mjs') !== null, 'parity report');
check(
  'our-navigation-generator',
  read('scripts/reference/build-our-navigation-map.mjs') !== null,
  'our navigation map',
);

const launcher = read('scripts/reference/launch-reference-browser.mjs') ?? '';
check(
  'launcher-cross-platform',
  /darwin/.test(launcher) && /linux/.test(launcher) && /win32/.test(launcher),
  'launcher must resolve darwin, linux, and win32',
);

const schemas = read('.reference/_schema/schemas.json') ?? '';
for (const kind of [
  'navigation-map',
  'surface-inventory',
  'action-inventory',
  'role-permission-matrix',
  'journey-catalog',
  'parity-matrix',
  'unknowns',
  'coverage-summary',
]) {
  check(`schema-${kind}`, schemas.includes(`"${kind}"`), `schema for ${kind}`);
}

// Canonical CDP configuration: exactly one operational source of truth.
const canonicalConfig = read('.reference/reference-config.default.json');
check(
  'cdp-canonical-source',
  canonicalConfig !== null && /"cdp"/.test(canonicalConfig),
  '.reference/reference-config.default.json#cdp',
);
const configLib = read('scripts/reference/lib/config.mjs') ?? '';
check(
  'cdp-canonical-resolver',
  /export function resolveCdpEndpoint/.test(configLib),
  'resolveCdpEndpoint in scripts/reference/lib/config.mjs',
);
check(
  'cdp-loopback-enforced',
  /CDP_NOT_LOOPBACK/.test(configLib),
  'resolver must reject a non-loopback host with CDP_NOT_LOOPBACK',
);

try {
  const parsed = JSON.parse(canonicalConfig ?? '{}');
  const host = parsed.cdp?.host;
  check(
    'cdp-configured-host-loopback',
    ['127.0.0.1', 'localhost', '::1'].includes(host),
    `configured host "${host}" must be loopback`,
  );
  check(
    'cdp-configured-port',
    Number.isInteger(parsed.cdp?.port),
    'canonical port must be an integer',
  );
} catch (err) {
  check('cdp-configured-host-loopback', false, `unreadable canonical CDP config: ${err.message}`);
}

// No operational component may carry its own endpoint literal. Test overrides
// go through OMA_REFERENCE_CDP_PORT, never through a second committed value.
const CDP_LITERAL = /(?:9222|9333|59999|:\d{4,5}\/json)/;
const operationalFiles = [
  'scripts/reference/launch-reference-browser.mjs',
  'scripts/reference/cdp-preflight.mjs',
  'scripts/reference/inspect-reference.mjs',
  'scripts/reference/playwright-mcp.mjs',
  'scripts/reference/parity-report.mjs',
  'scripts/reference/build-our-navigation-map.mjs',
  'scripts/reference/reference-worker-smoke.mjs',
  'scripts/reference/validate-reference-artifacts.mjs',
  'scripts/dev-os/doctor.mjs',
  '.opencode/mcp.json',
];
const drifted = operationalFiles.filter((path) => {
  const content = read(path);
  return content !== null && CDP_LITERAL.test(content);
});
check(
  'cdp-no-operational-hardcodes',
  drifted.length === 0,
  drifted.length
    ? `endpoint literal found in ${drifted.join(', ')}`
    : 'no operational endpoint literals',
);
check(
  'cdp-mcp-uses-resolver',
  /playwright-mcp\.mjs/.test(read('.opencode/mcp.json') ?? ''),
  'Playwright MCP must resolve the endpoint through the wrapper',
);

// Source-integrity guard.
const integrityLib = read('scripts/reference/lib/source-integrity.mjs');
check(
  'source-integrity-guard',
  integrityLib !== null,
  'scripts/reference/lib/source-integrity.mjs',
);
check(
  'source-integrity-violation-status',
  /REFERENCE_WORKER_POLICY_VIOLATION/.test(integrityLib ?? ''),
  'guard must return REFERENCE_WORKER_POLICY_VIOLATION',
);
check(
  'source-integrity-covers-untracked',
  /--untracked-files=all/.test(integrityLib ?? ''),
  'snapshot must cover untracked writes, not only tracked edits',
);
check(
  'source-integrity-wired-into-inspection',
  /verifySource/.test(read('scripts/reference/inspect-reference.mjs') ?? ''),
  'every inspection run must be bracketed by the guard',
);
check(
  'source-integrity-no-silent-repair',
  !/checkout --|git restore|reset --hard/.test(integrityLib ?? ''),
  'guard must not repair unauthorized writes',
);
check(
  'devos-isolation-tests',
  existsSync(join(REPO_ROOT, 'tests/dev-os')),
  'tests/dev-os deterministic guard tests',
);

const gitignore = read('.gitignore') ?? '';
check(
  'gitignore-reference-secrets',
  /\.chrome-profile/.test(gitignore) && /logs/.test(gitignore),
  '.gitignore must exclude the reference browser profile and logs',
);

const failed = checks.filter((c) => c.status === 'FAIL');
for (const c of checks) {
  process.stdout.write(
    `${c.status === 'PASS' ? 'PASS' : 'FAIL'}  ${c.name}${c.status === 'PASS' ? '' : ` — ${c.detail}`}\n`,
  );
}
process.stdout.write(`\n${checks.length - failed.length}/${checks.length} checks passed\n`);
const cdpChecks = checks.filter((c) => c.name.startsWith('cdp-'));
process.stdout.write(
  `CDP: ${cdpChecks.every((c) => c.status === 'PASS') ? 'CDP_CONFIG_CONSISTENT' : 'CDP_CONFIG_CONFLICT'}\n`,
);
process.stdout.write(
  failed.length ? 'STATUS: DEVELOPMENT_OS_INVALID\n' : 'STATUS: DEVELOPMENT_OS_VALID\n',
);
process.exit(failed.length ? 1 : 0);
