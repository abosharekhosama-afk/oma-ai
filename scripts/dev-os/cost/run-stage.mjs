#!/usr/bin/env node
/**
 * Development OS stage runner — automatic usage ledger for substantial stages.
 *
 * usage:
 *   node scripts/dev-os/cost/run-stage.mjs --stage IMPLEMENT -- node scripts/...
 *   node scripts/dev-os/cost/run-stage.mjs --stage TRIVIAL -- echo ok
 *   node scripts/dev-os/cost/run-stage.mjs --stage REFERENCE_DISCOVERY --dry-run
 *
 * Does not call models. Does not poll billing.
 * Telemetry missing → NOT_OBSERVABLE (does not fail product work).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  isSubstantialStage,
  isTrivialStage,
  normalizeStage,
  ensureLedgerRoot,
  writeCurrentPointer,
  defaultLedgerRoot,
} from "./lib/stages.mjs";

function parseArgs(argv) {
  const out = { _: [], env: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--") {
      out._ = argv.slice(i + 1);
      break;
    }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i += 1;
      } else out[key] = true;
    } else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const stage = normalizeStage(args.stage || args._[0] || "");
const cwd = args.cwd || process.cwd();
const dryRun = Boolean(args["dry-run"]);

if (!stage || args.help) {
  process.stdout.write(
    [
      "usage: node scripts/dev-os/cost/run-stage.mjs --stage <STAGE> [--dry-run] -- <command...>",
      "substantial stages auto-create .dev-os/ledgers/<stage>-<ts>.json + CURRENT.json",
      "trivial stages skip ledger",
      "",
    ].join("\n"),
  );
  process.exit(stage ? 0 : 2);
}

const substantial = isSubstantialStage(stage);
const trivial = isTrivialStage(stage);

let ledgerPath = null;
let ledgerCapture = "SKIPPED_TRIVIAL";

if (substantial) {
  const root = args["ledger-root"] ? path.resolve(cwd, args["ledger-root"]) : ensureLedgerRoot(cwd);
  fs.mkdirSync(root, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  ledgerPath = path.join(root, `${stage}-${stamp}.json`);
  const doc = {
    stage,
    createdAt: new Date().toISOString(),
    ledgerCapture: "AUTOMATIC",
    substantial: true,
    cursorPremiumCalls: 0,
    cursorSpecialistCalls: [],
    openCodeWorkerCalls: [],
    retries: [],
    evidencePacket: null,
    whyTwoSpecialistsRequired: null,
    contextStrategy: "MINIMUM_NECESSARY",
    fullRepoSent: false,
    fullChatHistorySent: false,
    deterministicViaModel: false,
    silentPaidFallback: false,
    openCodeFailedThenCursorPremium: false,
    unnecessaryReferenceReinspect: false,
    highCostInheritChain: false,
    reranCompletedStage: false,
    wholesaleReportReplay: false,
    uselessRetries: 0,
    telemetryValues: "NOT_OBSERVABLE",
    entries: [],
  };
  fs.writeFileSync(ledgerPath, JSON.stringify(doc, null, 2) + "\n");
  // Prefer writing CURRENT under the same ledger-root (tests) or default
  if (args["ledger-root"]) {
    fs.writeFileSync(
      path.join(root, "CURRENT.json"),
      JSON.stringify(
        {
          stage,
          substantial: true,
          ledgerPath,
          ledgerRel: path.relative(cwd, ledgerPath),
          updatedAt: new Date().toISOString(),
          ledgerCapture: "AUTOMATIC",
        },
        null,
        2,
      ) + "\n",
    );
  } else {
    writeCurrentPointer({ cwd, ledgerPath, stage, substantial: true });
  }
  ledgerCapture = "AUTOMATIC";
  process.env.DEV_OS_LEDGER = ledgerPath;
  process.env.DEV_OS_STAGE = stage;
}

const summary = {
  stage,
  substantial,
  trivial,
  ledgerCapture,
  ledgerPath,
  ledgerRoot: args["ledger-root"] || defaultLedgerRoot(cwd),
  telemetryValues: "NOT_OBSERVABLE",
  status: "READY",
};

if (dryRun || !args._.length) {
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  process.exit(0);
}

const cmd = args._[0];
const cmdArgs = args._.slice(1);
const res = spawnSync(cmd, cmdArgs, {
  cwd,
  env: { ...process.env, DEV_OS_LEDGER: ledgerPath || process.env.DEV_OS_LEDGER || "", DEV_OS_STAGE: stage },
  stdio: "inherit",
  shell: false,
});

summary.commandExit = res.status ?? 1;
summary.status = summary.commandExit === 0 ? "OK" : "COMMAND_FAILED";
process.stdout.write(JSON.stringify({ ...summary, note: "stage command finished" }, null, 2) + "\n");
process.exit(summary.commandExit);
