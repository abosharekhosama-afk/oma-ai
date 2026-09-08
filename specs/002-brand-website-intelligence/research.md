# Research: Brand Website Intelligence

**Feature**: `002-brand-website-intelligence`
**Date**: 2026-08-26
**Plan status**: `APPROVED FOR TASK DECOMPOSITION`
**Authority**: [`spec.md`](./spec.md), clarifications DP-001–DP-005, Foundation `DEC-004` / `DEC-007` / `DEC-003`

This document records **options for future decisions**. Nothing here closes Foundation DECs or selects production vendors.

**Phase BG (2026-09-08):** Owner adopted `DEC-016` — **PRODUCT-FIRST / EXTERNAL-INTEGRATIONS-LAST**. Live crawl/AI options in [`decisions/phase-bg-decision-packet.md`](./decisions/phase-bg-decision-packet.md) are `DEFERRED_TO_FINAL_INTEGRATION_PHASE` with **no provider selected**. `DEC-004`/`DEC-007` remain open (not resolved). See [`docs/PRODUCT_DELIVERY_SEQUENCING.md`](../../docs/PRODUCT_DELIVERY_SEQUENCING.md).

---

## 0. Locked for 002 (not research choices)

| Topic                                                  | Locked by               |
| ------------------------------------------------------ | ----------------------- |
| Public HTTPS crawl only                                | `SR-002-004-MODE`       |
| No commerce connector in 002                           | DP-001                  |
| `WebsiteConnectorPort` / `AiProviderPort`              | Spec + Foundation ports |
| No AI SDK/keys/third-party until `DEC-007`             | `SR-002-007-AI`         |
| Evidence excerpts (not full snapshots) until `DEC-003` | Spec + plan             |
| Stack = DEC-014 monolith                               | Foundation              |

---

## 1. Public crawl implementation options (future — DEC-004 / vendor)

**Question deferred:** Which production mechanism fetches public pages after product rules are fixed?

| Option                                                                      | Security                                                 | Region                               | Retention               | Cost         | Rate limits   | Reliability    | Observability           | Lock-in     | Notes                                           |
| --------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------ | ----------------------- | ------------ | ------------- | -------------- | ----------------------- | ----------- | ----------------------------------------------- |
| **A. First-party fetch worker** (HTTP client inside OMA worker behind port) | Full control of SSRF/redirect policy                     | Deploy-region dependent              | OMA-controlled excerpts | Infra only   | Self-managed  | Depends on ops | Full logs/metrics       | Low         | Fits modular monolith; still needs careful SSRF |
| **B. Managed crawl SaaS** (unnamed classes: browser/crawl APIs)             | Shared responsibility; must still enforce OMA allowlists | Often multi-region; residency varies | Vendor logs risk        | Usage-priced | Vendor quotas | Usually high   | Vendor dashboards + OMA | Medium–High | Must not become design reference (`DEC-013`)    |
| **C. Hybrid** — first-party for HTML; optional render service later         | Complex                                                  | Mixed                                | Mixed                   | Mixed        | Mixed         | Mixed          | Mixed                   | Medium      | Only if JS-heavy sites become P0 later          |

### `RECOMMENDATION FOR FUTURE DECISION`

**Prefer Option A (first-party fetch behind `WebsiteConnectorPort`)** for public HTML/JSON-LD sites in early production after security review — lowest lock-in, aligns with existing worker model, keeps SSRF policy in-process. Revisit B only if render-at-scale or IP reputation becomes a measured blocker. **Not adopted now.**

**Until then:** fixture / deterministic test adapter + refusing production adapter.

---

## 2. AI provider options (future — DEC-007)

**Question deferred:** Which providers/models may process public website excerpts and brand drafts? Retention, region, logging, cost, fallback?

| Option                                            | Security/privacy         | Region/residency            | Retention        | Cost          | Rate limits | Reliability       | Observability           | Lock-in | Arabic capability                 |
| ------------------------------------------------- | ------------------------ | --------------------------- | ---------------- | ------------- | ----------- | ----------------- | ----------------------- | ------- | --------------------------------- |
| **A. No live AI** (port refusing; manual profile) | Best for 002 launch      | N/A                         | N/A              | Lowest        | N/A         | N/A               | N/A                     | None    | Human EN/AR                       |
| **B. Single frontier LLM API** (unnamed)          | DPA + redaction required | Often limited regions       | Vendor-dependent | Token-metered | Strict      | Generally high    | Vendor + OMA provenance | High    | Varies by model; must validate AR |
| **C. Multi-provider router** behind port          | Flexibility              | Can pin region per provider | Complex          | Variable      | Complex     | Failover possible | Harder                  | Medium  | Can pick AR-capable route         |

### `RECOMMENDATION FOR FUTURE DECISION`

Keep **Option A** for 002 implementation and first production gate. When `DEC-007` closes, prefer a **port-shaped single provider with explicit region/retention/cost policy** (class B) before multi-router complexity (C). Require Arabic quality acceptance tests before enabling live proposals. **Not adopted now.**

---

## 3. Evidence storage options (future — DEC-003)

| Option                                        | Fit for 002              | Lock-in               | Note                           |
| --------------------------------------------- | ------------------------ | --------------------- | ------------------------------ |
| **A. Postgres excerpts + hashes + URLs only** | **Required default now** | Low                   | Matches open DEC-003           |
| **B. Object storage full HTML snapshots**     | Gated                    | Medium                | Needs DEC-003 ownership answer |
| **C. WorkDrive-linked artifacts**             | Out of 002               | High process coupling | DEC-003 / WorkDrive            |

### `RECOMMENDATION FOR FUTURE DECISION`

Stay on **A** until DEC-003. If legal/replay needs full HTML, decide B vs C explicitly — do not invent storage in 002 implement.

---

## 4. Decision Gate matrix

| Gate              | Can plan now             | Can implement now (after tasks)       | Forbidden until closed / authorized               |
| ----------------- | ------------------------ | ------------------------------------- | ------------------------------------------------- |
| `SR-002-004-MODE` | Yes                      | Public crawl domain + fixture adapter | Commerce SoT; production crawl vendor             |
| `DEC-004` global  | Document only            | —                                     | Closing as “both” without new slice               |
| `SR-002-007-AI`   | Yes                      | Manual path + refusing port           | Live AI SDK/keys/third-party                      |
| `DEC-007` global  | Research only            | —                                     | Final retention/region/cost policy as product law |
| `DEC-003`         | Excerpts design          | Excerpts only                         | Full snapshot/object store assumption             |
| `DEC-008`         | Multi-brand interim      | Zero+ brands per tenant               | Agency cross-tenant                               |
| `DEC-009`         | Single internal approver | Version approve capability            | Client multi-step topology                        |
| `DEC-012`         | Min retain for review    | Soft hooks                            | Market-specific retention                         |

---

## 5. Alternatives considered and rejected for 002

| Idea                                         | Rejected because                            |
| -------------------------------------------- | ------------------------------------------- |
| Microservice for crawler                     | Violates DEC-014 modular monolith; ops cost |
| Parallel tenant for “brand org”              | Violates Foundation tenancy                 |
| Approve without incompleteness UI on Partial | Violates DP-003 / FR-BWI-029a               |
| Require live AI for MVP                      | Violates SR-002-007-AI and SC-BWI-001       |
| Crawl public internet in CI                  | Non-deterministic; policy risk              |

---

## 6. Open technical spikes (non-blocking for plan approval)

- Exact default page/depth/time/byte budgets (config constants at implement).
- Progress percent formula (pages attempted vs budget).
- Whether analysis job is skipped entirely vs no-op Succeeded when AI absent (product: Partial when usable data — plan prefers skip AI job and mark attempt Partial from ingestion completion path).

---

## 7. Sources

- Foundation: `specs/001-oma-ai-product-foundation/spec.md` (DEC-003/004/007/013/014), `contracts/connector-ports.md`, `contracts/jobs-outbox.md`
- Feature: `specs/002-brand-website-intelligence/spec.md` Clarifications 2026-08-26
- Code patterns: `apps/worker` JobRun correlation, `packages/domain` ports

No third-party marketing pages are cited as design references beyond `DEC-013` roles.
