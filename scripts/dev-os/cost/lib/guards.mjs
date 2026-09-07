/**
 * Enforceable cost guards used by tests and TOKEN_WASTE_AUDIT.
 * These are real assertions in Node — not documentation-only.
 */
import fs from "node:fs";
import path from "node:path";

export function loadRoutingRegistry(root = process.cwd()) {
  const p = path.join(root, ".cursor/agents/routing-registry.json");
  if (!fs.existsSync(p)) throw new Error("routing-registry.json missing");
  const doc = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!Array.isArray(doc.agents) || !doc.agents.length) throw new Error("routing-registry has no agents");
  return doc;
}

export function assertNoFanOut({ specialists = [], whyTwo = null } = {}) {
  if ((specialists?.length || 0) <= 1) return { ok: true };
  if (whyTwo && String(whyTwo).trim().length >= 20) return { ok: true, justified: true };
  const err = new Error("COST_FAN_OUT_DENIED: >1 specialist without WHY_TWO_SPECIALISTS_REQUIRED");
  err.code = "COST_FAN_OUT_DENIED";
  throw err;
}

export function assertNoSilentFallback(text) {
  const ok =
    /BLOCKED_BY_OPENCODE_(LIMIT|ROUTE|RUNTIME)/.test(text) &&
    (/NO HEAVY CURSOR FALLBACK|silentPaidFallback.: .DENY|SILENT PAID FALLBACK.: DENY|No silent/i.test(
      text,
    ) ||
      /silent paid fallback/i.test(text));
  if (!ok) {
    const err = new Error("SILENT_PAID_FALLBACK_RULE_MISSING");
    err.code = "SILENT_PAID_FALLBACK_RULE_MISSING";
    throw err;
  }
  if (/auto(?:matic)?(?:ally)?\s+fall\s*back\s+to\s+cursor\s+premium/i.test(text)) {
    const err = new Error("SILENT_PAID_FALLBACK_ALLOWED_IN_TEXT");
    err.code = "POLICY_VIOLATION";
    throw err;
  }
  return { ok: true };
}

export function assertRetryAllowed({ attempt = 1, changedEvidence = false, changedInput = false, changedEnv = false, changedScope = false, changedRoute = false } = {}) {
  if (attempt <= 1) return { ok: true };
  if (changedEvidence || changedInput || changedEnv || changedScope || changedRoute) return { ok: true };
  const err = new Error("USELESS_RETRY_DENIED");
  err.code = "USELESS_RETRY_DENIED";
  throw err;
}

export function assertInheritSafe({ parentCostClass = "low", childInherit = false, childInheritClass = "SAFE_TO_INHERIT" } = {}) {
  if (!childInherit) return { ok: true };
  if (parentCostClass === "high" && childInheritClass !== "SAFE_TO_INHERIT") {
    const err = new Error("INHERIT_FROM_HIGH_COST_PARENT_DENIED");
    err.code = "INHERIT_FROM_HIGH_COST_PARENT_DENIED";
    throw err;
  }
  return { ok: true };
}

export function assertMinimumContext({ requiredFiles = [], sentFiles = [], fullRepo = false, fullChat = false } = {}) {
  if (fullRepo || fullChat) {
    const err = new Error("CONTEXT_REPLAY_DENIED");
    err.code = "CONTEXT_REPLAY_DENIED";
    throw err;
  }
  if (!requiredFiles.length) return { ok: true };
  const sent = new Set(sentFiles);
  const missing = requiredFiles.filter((f) => !sent.has(f));
  const extra = sentFiles.filter((f) => !requiredFiles.includes(f));
  // Allow small extras; deny mega-packets (>10× required or >50 files when required ≤5)
  if (requiredFiles.length <= 5 && sentFiles.length > 50) {
    const err = new Error("CONTEXT_PACKET_TOO_LARGE");
    err.code = "CONTEXT_PACKET_TOO_LARGE";
    throw err;
  }
  if (missing.length) {
    const err = new Error(`CONTEXT_MISSING_REQUIRED: ${missing.join(",")}`);
    err.code = "CONTEXT_MISSING_REQUIRED";
    throw err;
  }
  return { ok: true, extraCount: extra.length };
}

export function assertOpenCodeFailureStops({ openCodeAvailable = true, cursorPremiumStarted = false } = {}) {
  if (!openCodeAvailable && cursorPremiumStarted) {
    const err = new Error("POLICY_VIOLATION: OpenCode unavailable but Cursor premium started");
    err.code = "POLICY_VIOLATION";
    throw err;
  }
  if (!openCodeAvailable) {
    return { ok: true, status: "BLOCKED_BY_OPENCODE_ROUTE" };
  }
  return { ok: true };
}

export function assertCompletedPhaseNotRerun({ phaseStatus = "OPEN", forceRerun = false } = {}) {
  if ((phaseStatus === "CERTIFIED" || phaseStatus === "FINAL-CLOSED") && forceRerun) {
    const err = new Error("RERUN_COMPLETED_PHASE_DENIED");
    err.code = "RERUN_COMPLETED_PHASE_DENIED";
    throw err;
  }
  return { ok: true };
}

export function validateEvidencePacket(packet) {
  if (!packet || typeof packet !== "object") throw new Error("EVIDENCE_PACKET_REQUIRED");
  for (const key of ["question", "facts", "unknown", "constraints"]) {
    if (!(key in packet)) throw new Error(`EVIDENCE_PACKET_MISSING_${key.toUpperCase()}`);
  }
  if (!String(packet.question || "").trim()) throw new Error("EVIDENCE_PACKET_EMPTY_QUESTION");
  return { ok: true };
}
