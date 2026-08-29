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
process.stdout.write(
  failed.length ? 'STATUS: DEVELOPMENT_OS_INVALID\n' : 'STATUS: DEVELOPMENT_OS_VALID\n',
);
process.exit(failed.length ? 1 : 0);
