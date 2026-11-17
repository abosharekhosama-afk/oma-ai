# Quickstart — Scan, Analysis & Strategy Operational Closure (005)

**Purpose:** Run the **proof journey** for `SCAN_ANALYSIS_STRATEGY_OPS_CLOSURE: VERIFIED` without claiming Phase BG vendor closure.

---

## 1. Minimum environment

| Component              | Required for CORE (`DP-005-002` A) | Notes                                                            |
| ---------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| PostgreSQL             | Yes                                | Same DB for API + Worker                                         |
| Redis                  | Yes                                | BullMQ prefix `oma` (default)                                    |
| API (`apps/api`)       | Yes                                |                                                                  |
| Worker (`apps/worker`) | Yes                                | Must run `ingestion`, `analysis`, `catalog` processors           |
| Web (`apps/web`)       | Yes                                | For manual proof; API-only sufficient for integration test       |
| Live website connector | Yes                                | `BRAND_WEBSITE_CONNECTOR=live` (default on 004 when not fixture) |
| `AI_LIVE_ENABLED`      | Optional                           | Manual profile path works without                                |
| WorkDrive              | No (CORE)                          | Only for `catalog.generate` (Phase 5)                            |

### Example env (Worker + API)

```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://127.0.0.1:6379
BRAND_WEBSITE_CONNECTOR=live
BRAND_MAX_PAGES=30
BRAND_MAX_DEPTH=2
BRAND_SCANNER_JS_RENDER_MODE=auto
# Optional AI
AI_LIVE_ENABLED=true
AI_PROVIDER=openai
OPENAI_API_KEY=...
```

**Do not** set `BRAND_FIXTURE_CONNECTOR=1` for real-site closure proof.

---

## 2. Proof journey (manual)

1. **Owner** logs in; creates/opens brand; connects **public HTTPS** URL.
2. **Start scan**; wait until `SUCCEEDED` or `PARTIAL`; note `scanId`.
3. Open **Discovery → Products**; confirm products; if media missing, run **Reimport media** for scan.
4. Open **Profile draft** from scan; optionally wait for **analysis** job if AI enabled; accept/edit proposals.
5. **Refresh catalog from scan** (after T032) or approve with catalog materialization (T033).
6. **Approve** profile version.
7. Create **Strategy** draft; link approved profile; complete foundation; submit; **approve** package.
8. **Strategy → Plan requests**: preview shows `catalog_offerings_count > 0`; commit at least one catalog-anchored request.
9. Save evidence: scan id, profile version id, strategy version id, work request ids → `artifacts/closure-005/evidence.json`.

---

## 3. Automated proof

```bash
pnpm test -- tests/integration/scan-analysis-strategy-closure.integration.test.ts
```

Requires `CLOSURE_PROOF_URL` (allowlisted public site) when test is added in T040.

---

## 4. Failure triage

| Symptom                    | Check                                                                       |
| -------------------------- | --------------------------------------------------------------------------- |
| Scan stuck QUEUED/RUNNING  | Worker running? Redis? Queue depth via T002 probe                           |
| `NOT_CONFIGURED` connector | Env fixture/disabled; set live connector                                    |
| 0 products                 | JS-render mode; try reimport; new scan                                      |
| AI no proposals            | `AI_LIVE_ENABLED` + key; analysis job in `job_run`                          |
| Plan catalog count 0       | Profile `sectionsJson.catalog`; run refresh; fallback flag `catalog_source` |
| Generate 409 profile       | Approve profile first                                                       |

---

## 5. Production topology runbook (T003)

| Topology          | Scan/analysis/catalog | When to use                           |
| ----------------- | --------------------- | ------------------------------------- |
| Vercel API only   | **Broken** for crawl  | Never for closure proof               |
| API + Worker + DB | **Required**          | All CORE 005 verification             |
| API + Worker home | Same as row above     | Long-running scans (`pnpm dev` stack) |

Canonical ops lock: [`docs/PRODUCTION_LOCK_WORK_OPS.md`](../../docs/PRODUCTION_LOCK_WORK_OPS.md).

**Queue probe:** `GET /api/v1/platform/health/queues` (depth only; worker heartbeat honest when unknown).

---

## 6. Sign-off

Owner marks checklist in [`checklists/requirements.md`](./checklists/requirements.md) and confirms `DP-005-001`–`003` in [`decisions/`](./decisions/).
