# Quickstart Validation Guide — Brand Website Intelligence

**Feature:** `002-brand-website-intelligence`
**Status:** `APPROVED FOR TASK DECOMPOSITION` (proof guide; implement not started)
**Purpose:** Define how 002 behavior will be proven after implementation.
**Not:** runnable today (`TASKS_ONLY` — no product code in this stage).

## Prerequisites (when implemented)

- Foundation stack running: API, web, worker, Postgres, Redis
- Local **deterministic website fixture** (e.g. static server under `tests/fixtures/websites/`) on allowlisted loopback
- Default adapters: fixture `WebsiteConnectorPort` in test/dev; **refusing** `AiProviderPort` unless a test explicitly injects a double
- **No** egress to public websites in CI
- Seed users with/without brand capabilities; two tenants T1/T2

---

## Journey Q-BWI-01 — Create → Connect fixture → Scan → Review → Approve

1. As T1 owner with brand capabilities: `POST /brands` → Draft.
2. `POST /brands/:id/website` with fixture HTTPS URL + `authorization_attested: true` → `READY_TO_SCAN`.
3. `POST /brands/:id/scans` with Idempotency-Key → `202`, `ScanAttempt QUEUED`, `JobRun` linked.
4. Worker crawls fixture via port; attempt reaches `SUCCEEDED` or `PARTIAL` with reviewable data; Draft/Needs review profile created.
5. Review pages/products/evidence; edit required fields if needed; dispose insights.
6. `POST .../profiles/:versionId/approve` with eligibility + `confirm_summary` → `APPROVED` immutable.
7. Refresh / re-login → current approved version persists.

**Expect:** Full chain `action → authz → persist → worker → UI → refresh`. Audit for connect, start, approve.

---

## Journey Q-BWI-02 — Partial scan → Disclosure → Confirm → Approve

1. Configure fixture/limits so attempt ends `PARTIAL` (failed/skipped pages + usable observations).
2. Open approval UI: incompleteness banner, failed/skipped pages, missing required, coverage, AI availability, version id visible.
3. Attempt approve **without** `acknowledge_incomplete` → `422 APPROVAL_INELIGIBLE`.
4. Approve with `acknowledge_incomplete: true` + `confirm_summary: true` when FR-BWI-029a holds → success.
5. Audit contains incompleteness warnings acknowledged (`FR-BWI-029d`).

---

## Journey Q-BWI-03 — AI not configured → Manual profile → Approve

1. Ensure refusing / not-configured AI adapter.
2. Complete crawl with usable observations → attempt `PARTIAL` (not Failed); AI-unavailable banner; no claim that AI ran.
3. Manually complete `REQUIRED_FOR_APPROVAL`; evidence remains linked.
4. Approve without any `AI_INFERRED` items → success.
5. Negative: insufficient observations → `FAILED`; approve denied.

---

## Journey Q-BWI-04 — Cancel / Retry

1. Start scan; while `CRAWLING`/`QUEUED`, cancel → `CANCELLED`; JobRun cancelled/dead appropriately.
2. Approve path on Cancelled version/attempt → denied.
3. Retry from Cancelled/Failed/Partial → **new** `ScanAttempt` + new JobRun; parent retained for history.
4. Duplicate start with same Idempotency-Key → one attempt.

---

## Journey Q-BWI-05 — Cross-tenant denial

1. Create brand B1 in T1.
2. As T2 member, `GET /brands/B1` and scan/profile/evidence by id → `404`/`403` without leaking existence.
3. Attempt start scan / approve with forged ids → denied.
4. Worker payload with mismatched `tenant_id` / `job_run_id` → no mutate (integration test).

---

## Journey Q-BWI-06 — Membership suspended mid-job

1. Start scan as active member.
2. Latch worker before crawl write; suspend membership (or revoke `brand.scan.control`).
3. Worker resumes → JobRun dead/failed `PERMISSION_DENIED`; ScanAttempt `FAILED`; no success audit; no mail/false progress success.
4. UI shows failed/permission state after refresh.

---

## Journey Q-BWI-07 — Rescan after Approved → new Draft

1. Brand has Approved version V1.
2. Rescan (new START or RESCAN trigger) → new attempt; new Draft V2 for review/compare.
3. V1 remains Approved and unchanged; brand pointer still V1 until V2 approved.
4. Approve V2 → V1 `SUPERSEDED`; pointer → V2.

---

## Journey Q-BWI-08 — Late result does not mutate Approved

1. Approve version V1.
2. Simulate late worker completion / late analysis for the originating attempt.
3. Assert: V1 rows unchanged (content hash / updated_at policy); no patch to Approved insights.
4. Any late material appears only on a **new Draft** (or is dropped with audit), never on V1.

---

## Additional proofs (bundle with above or separate)

| ID | Focus |
| -- | ----- |
| Q-BWI-09 | Insight decide cannot whole-version reject (403); Version approve can |
| Q-BWI-10 | Concurrent edit → `409 CONFLICT_VERSION` |
| Q-BWI-11 | SSRF: private IP / metadata / credential URL / bad redirect → blocked |
| Q-BWI-12 | EN/AR + RTL + keyboard + reduced motion on brand list, progress, evidence panel, approval |
| Q-BWI-13 | Capability matrix deny-by-default for each brand.* code |

---

## Mapping to success criteria

| Journey | Spec |
| ------- | ---- |
| Q-BWI-01 | SC-BWI core create→approve |
| Q-BWI-02 | Partial approval / FR-BWI-029a–d |
| Q-BWI-03 | SC-BWI AI-unavailable / FR-BWI-028b |
| Q-BWI-04 | Cancel/retry / FR-BWI-015–016 |
| Q-BWI-05 | Tenant isolation |
| Q-BWI-06 | Mid-flight reauthz |
| Q-BWI-07 | FR-BWI-031 rescan |
| Q-BWI-08 | FR-BWI-030 late results |

---

## Explicitly not validated in 002 quickstart

- Live public-internet crawl vendor
- Live third-party AI
- Full-page object-storage snapshots (`DEC-003`)
- Commerce connectors (`DEC-004` global)
- Competitor/strategy/paid/WorkDrive/Meta features (`FR-BWI-037`)
