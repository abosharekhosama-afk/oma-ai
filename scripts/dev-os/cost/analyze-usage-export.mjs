#!/usr/bin/env node
/**
 * Deterministic Cursor usage-export analyzer.
 * Does not estimate missing fields. Does not call models.
 *
 * usage: node scripts/dev-os/cost/analyze-usage-export.mjs [--csv path] [--json]
 */
import fs from "node:fs";
import path from "node:path";
import { parseUsageCsv, summarizeUsage } from "./lib/usage.mjs";

const args = process.argv.slice(2);
const jsonOut = args.includes("--json");
const csvIdx = args.indexOf("--csv");
const csvPath =
  csvIdx >= 0
    ? args[csvIdx + 1]
    : process.env.CURSOR_USAGE_CSV ||
      path.join(process.env.HOME || "", "Downloads", "usage-events-2026-09-06.csv");

if (!fs.existsSync(csvPath)) {
  const payload = {
    status: "NOT_OBSERVABLE",
    reason: `usage CSV not found: ${csvPath}`,
    hint: "Pass --csv <path> or set CURSOR_USAGE_CSV",
  };
  process.stdout.write(jsonOut ? JSON.stringify(payload, null, 2) + "\n" : `STATUS  NOT_OBSERVABLE\nREASON  ${payload.reason}\n`);
  process.exit(0);
}

const rows = parseUsageCsv(csvPath);
const summary = summarizeUsage(rows);
summary.source = csvPath;
summary.status = "OK";

if (jsonOut) {
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
} else {
  const lines = [
    "USAGE EXPORT ANALYSIS",
    "=====================",
    `SOURCE              ${summary.source}`,
    `TOTAL_EVENTS        ${summary.totalEvents}`,
    `INCLUDED            ${summary.kinds.Included ?? 0}`,
    `FREE                ${summary.kinds.Free ?? 0}`,
    `ON_DEMAND_EVENTS    ${summary.onDemandEvents}`,
    `ON_DEMAND_COST      $${summary.onDemandCost.toFixed(2)}`,
    `TOTAL_TOKENS        ${summary.totalTokens}`,
    `CACHE_READ          ${summary.cacheRead}`,
    `CACHE_READ_SHARE    ${summary.cacheReadSharePct}%`,
    `FAN_OUT_MINUTES≥3   ${summary.fanOutMinutesGe3}`,
    "",
    "TOP_PAID:",
    ...summary.topPaid.map(
      (e) => `  ${e.date}  ${e.model}  $${e.cost}  tokens=${e.tokens}  cache=${e.cache}`,
    ),
    "",
    "TOP_TOKEN:",
    ...summary.topToken.map(
      (e) => `  ${e.date}  ${e.kind}  ${e.model}  tokens=${e.tokens}  cache=${e.cache}`,
    ),
  ];
  process.stdout.write(lines.join("\n") + "\n");
}
