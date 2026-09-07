#!/usr/bin/env node
/**
 * Lightweight per-stage usage ledger writer/reader.
 * Deterministic. Does not call models.
 *
 * usage:
 *   node scripts/dev-os/cost/usage-ledger.mjs --init --stage P8_REF --out .reference/dev-os/usage-ledger.json
 *   node scripts/dev-os/cost/usage-ledger.mjs --append --ledger path --worker opencode --model oma-coder --purpose implement
 *   node scripts/dev-os/cost/usage-ledger.mjs --from-csv path.csv --json
 */
import fs from "node:fs";
import path from "node:path";
import { parseUsageCsv, summarizeUsage } from "./lib/usage.mjs";

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const get = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : null;
};

const out = get("--out") || get("--ledger") || ".reference/dev-os/usage-ledger.json";

if (flag("--from-csv")) {
  const csv = get("--from-csv") || get("--csv");
  if (!csv || !fs.existsSync(csv)) {
    process.stdout.write(JSON.stringify({ status: "NOT_OBSERVABLE", reason: "csv missing" }, null, 2) + "\n");
    process.exit(0);
  }
  const summary = summarizeUsage(parseUsageCsv(csv));
  process.stdout.write(JSON.stringify({ status: "OK", summary }, null, 2) + "\n");
  process.exit(0);
}

if (flag("--init")) {
  const doc = {
    stage: get("--stage") || "UNSPECIFIED",
    createdAt: new Date().toISOString(),
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
    entries: [],
  };
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
  process.stdout.write(`INITIALIZED ${out}\n`);
  process.exit(0);
}

if (flag("--append")) {
  if (!fs.existsSync(out)) {
    process.stderr.write(`ledger missing: ${out}\n`);
    process.exit(2);
  }
  const doc = JSON.parse(fs.readFileSync(out, "utf8"));
  const entry = {
    at: new Date().toISOString(),
    worker: get("--worker") || "UNKNOWN",
    model: get("--model") || "NOT_OBSERVABLE",
    purpose: get("--purpose") || "",
    callCount: Number(get("--calls") || 1),
    filesOrArtifactsSent: (get("--files") || "").split(",").filter(Boolean),
    contextStrategy: get("--context") || doc.contextStrategy,
    retryCount: Number(get("--retries") || 0),
    billingClass: get("--billing") || "NOT_OBSERVABLE",
    recordedCost: get("--cost") || "NOT_OBSERVABLE",
    inputTokens: get("--input") || "NOT_OBSERVABLE",
    cacheRead: get("--cache-read") || "NOT_OBSERVABLE",
    cacheWrite: get("--cache-write") || "NOT_OBSERVABLE",
    outputTokens: get("--output") || "NOT_OBSERVABLE",
    totalTokens: get("--total") || "NOT_OBSERVABLE",
  };
  doc.entries.push(entry);
  if (String(entry.worker).startsWith("cursor") || get("--specialist") === "1") {
    doc.cursorPremiumCalls += entry.callCount;
    doc.cursorSpecialistCalls.push(entry.model);
  }
  if (
    String(entry.worker).includes("opencode") ||
    entry.worker === "oma-coder" ||
    entry.worker === "imkan-coder" ||
    entry.worker === "reference-inspector"
  ) {
    doc.openCodeWorkerCalls.push(entry);
  }
  if (entry.retryCount > 0) doc.retries.push(entry);
  fs.writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
  process.stdout.write(`APPENDED ${out}\n`);
  process.exit(0);
}

process.stdout.write(
  [
    "usage: usage-ledger.mjs --init --stage <id> --out <path>",
    "       usage-ledger.mjs --append --ledger <path> --worker <w> --model <m> --purpose <p>",
    "       usage-ledger.mjs --from-csv <csv> [--json]",
  ].join("\n") + "\n",
);
process.exit(2);
