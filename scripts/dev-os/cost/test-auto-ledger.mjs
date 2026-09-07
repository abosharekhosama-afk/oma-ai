#!/usr/bin/env node
/**
 * Automatic ledger tests:
 * - substantial stage without --ledger → ledger created; TOKEN_WASTE can read it
 * - trivial stage → no unnecessary ledger noise
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { resolveLedgerPath } from "./lib/stages.mjs";

const root = process.cwd();
const results = [];
const run = (id, fn) => {
  try {
    fn();
    results.push({ id, status: "PASS" });
  } catch (e) {
    results.push({ id, status: "FAIL", error: String(e.message || e) });
  }
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "devos-ledger-"));

run("SUBSTANTIAL_AUTO_LEDGER", () => {
  const res = spawnSync(
    process.execPath,
    [
      "scripts/dev-os/cost/run-stage.mjs",
      "--stage",
      "REFERENCE_DISCOVERY",
      "--ledger-root",
      tmp,
      "--dry-run",
    ],
    { cwd: root, encoding: "utf8" },
  );
  if (res.status !== 0) throw new Error(res.stderr || res.stdout || "run-stage failed");
  const summary = JSON.parse(res.stdout);
  if (summary.ledgerCapture !== "AUTOMATIC") throw new Error("expected AUTOMATIC capture");
  if (!summary.ledgerPath || !fs.existsSync(summary.ledgerPath)) throw new Error("ledger file missing");
  const pointer = path.join(tmp, "CURRENT.json");
  if (!fs.existsSync(pointer)) throw new Error("CURRENT pointer missing");
});

run("TOKEN_WASTE_READS_AUTO_LEDGER", () => {
  // Point resolve at tmp by writing CURRENT into default location via env ledger
  const files = fs.readdirSync(tmp).filter((f) => f.endsWith(".json") && f !== "CURRENT.json");
  if (!files.length) throw new Error("no ledger in tmp");
  const ledgerPath = path.join(tmp, files[0]);
  const resolved = resolveLedgerPath({ cwd: root, explicit: ledgerPath });
  if (resolved.status !== "OBSERVABLE") throw new Error("ledger not observable");
  const audit = spawnSync(
    process.execPath,
    ["scripts/dev-os/cost/token-waste-audit.mjs", "--ledger", ledgerPath],
    { cwd: root, encoding: "utf8" },
  );
  const doc = JSON.parse(audit.stdout);
  if (doc.stageLedgerStatus !== "OBSERVED") throw new Error(`expected OBSERVED got ${doc.stageLedgerStatus}`);
  if (doc.status !== "PASS") throw new Error(`token waste ${doc.status}`);
  if (!doc.ledgerCapture) throw new Error("ledgerCapture missing");
});

run("TRIVIAL_NO_LEDGER_NOISE", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "devos-trivial-"));
  const res = spawnSync(
    process.execPath,
    ["scripts/dev-os/cost/run-stage.mjs", "--stage", "TRIVIAL", "--ledger-root", empty, "--dry-run"],
    { cwd: root, encoding: "utf8" },
  );
  if (res.status !== 0) throw new Error(res.stderr || "trivial failed");
  const summary = JSON.parse(res.stdout);
  if (summary.ledgerCapture !== "SKIPPED_TRIVIAL") throw new Error("expected skip");
  if (summary.ledgerPath) throw new Error("trivial should not create ledger path");
  const created = fs.existsSync(empty) ? fs.readdirSync(empty).filter((f) => f.endsWith(".json")) : [];
  if (created.length) throw new Error(`unexpected ledger noise: ${created.join(",")}`);
});

const failed = results.filter((r) => r.status === "FAIL");
process.stdout.write(
  JSON.stringify(
    {
      gate: "AUTO_LEDGER_TESTS",
      passed: results.filter((r) => r.status === "PASS").length,
      total: results.length,
      failed: failed.map((f) => f.id),
      results,
    },
    null,
    2,
  ) + "\n",
);
process.exit(failed.length ? 1 : 0);
