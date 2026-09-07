/**
 * Substantial-stage classification and default ledger paths.
 * Deterministic — no model calls.
 */
import fs from "node:fs";
import path from "node:path";

/** Canonical substantial stages that auto-enable usage ledger capture. */
export const SUBSTANTIAL_STAGES = Object.freeze([
  "REFERENCE_DISCOVERY",
  "SPEC",
  "PLAN",
  "TASKS",
  "IMPLEMENT",
  "BUG_COMPLEX",
  "E2E",
  "CERTIFICATION",
  "FINAL_VERIFICATION",
  "CONVERGENCE",
  "LARGE_REPO_INVESTIGATION",
]);

/** Trivial stages that must not create ledger noise. */
export const TRIVIAL_STAGES = Object.freeze([
  "TRIVIAL",
  "GIT_STATUS",
  "DETERMINISTIC_CHECK",
  "SMALL_EDIT",
  "CLARIFICATION",
]);

export function normalizeStage(stage) {
  return String(stage || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function isSubstantialStage(stage) {
  const s = normalizeStage(stage);
  if (!s) return false;
  if (TRIVIAL_STAGES.includes(s)) return false;
  if (SUBSTANTIAL_STAGES.includes(s)) return true;
  // aliases
  if (/^P\d+(_|$)/.test(s)) return true; // P7, P8_REF, etc.
  if (s.includes("REFERENCE") || s.includes("CERTIF") || s.includes("IMPLEMENT")) return true;
  if (s.includes("CONVERGENCE") || s.includes("E2E") || s.includes("SPEC") || s.includes("PLAN")) return true;
  return false;
}

export function isTrivialStage(stage) {
  const s = normalizeStage(stage);
  return TRIVIAL_STAGES.includes(s) || s === "" || s === "NONE";
}

export function defaultLedgerRoot(cwd = process.cwd()) {
  return path.join(cwd, ".dev-os", "ledgers");
}

export function currentPointerPath(cwd = process.cwd()) {
  return path.join(defaultLedgerRoot(cwd), "CURRENT.json");
}

export function ensureLedgerRoot(cwd = process.cwd()) {
  const root = defaultLedgerRoot(cwd);
  fs.mkdirSync(root, { recursive: true });
  const keep = path.join(root, ".gitkeep");
  if (!fs.existsSync(keep)) fs.writeFileSync(keep, "");
  return root;
}

/**
 * Resolve ledger path for TOKEN_WASTE_AUDIT without requiring --ledger.
 * Order: explicit → ENV → CURRENT pointer → newest substantial ledger → null
 */
export function resolveLedgerPath({ cwd = process.cwd(), explicit = null, env = process.env } = {}) {
  if (explicit && fs.existsSync(explicit)) {
    return { path: explicit, source: "EXPLICIT", status: "OBSERVABLE" };
  }
  if (env.DEV_OS_LEDGER && fs.existsSync(env.DEV_OS_LEDGER)) {
    return { path: env.DEV_OS_LEDGER, source: "ENV", status: "OBSERVABLE" };
  }
  const pointer = currentPointerPath(cwd);
  if (fs.existsSync(pointer)) {
    try {
      const doc = JSON.parse(fs.readFileSync(pointer, "utf8"));
      if (doc.ledgerPath && fs.existsSync(doc.ledgerPath)) {
        return { path: doc.ledgerPath, source: "CURRENT_POINTER", status: "OBSERVABLE", stage: doc.stage };
      }
      // relative path from repo root
      if (doc.ledgerRel && fs.existsSync(path.join(cwd, doc.ledgerRel))) {
        return {
          path: path.join(cwd, doc.ledgerRel),
          source: "CURRENT_POINTER",
          status: "OBSERVABLE",
          stage: doc.stage,
        };
      }
    } catch {
      /* ignore */
    }
  }
  const root = defaultLedgerRoot(cwd);
  if (fs.existsSync(root)) {
    const files = fs
      .readdirSync(root)
      .filter((f) => f.endsWith(".json") && f !== "CURRENT.json")
      .map((f) => ({ f, t: fs.statSync(path.join(root, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (files.length) {
      return { path: path.join(root, files[0].f), source: "NEWEST_LEDGER", status: "OBSERVABLE" };
    }
  }
  return { path: null, source: "NONE", status: "NOT_OBSERVABLE" };
}

export function writeCurrentPointer({ cwd = process.cwd(), ledgerPath, stage, substantial }) {
  ensureLedgerRoot(cwd);
  const rel = path.relative(cwd, ledgerPath);
  const doc = {
    stage,
    substantial: Boolean(substantial),
    ledgerPath,
    ledgerRel: rel,
    updatedAt: new Date().toISOString(),
    ledgerCapture: substantial ? "AUTOMATIC" : "SKIPPED_TRIVIAL",
  };
  fs.writeFileSync(currentPointerPath(cwd), JSON.stringify(doc, null, 2) + "\n");
  return doc;
}
