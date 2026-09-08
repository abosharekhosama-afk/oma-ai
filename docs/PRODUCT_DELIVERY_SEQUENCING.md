# Product Delivery Sequencing — PRODUCT-FIRST / EXTERNAL-INTEGRATIONS-LAST

**Status:** `CANONICAL`  
**Resolved as:** Foundation `DEC-016` (2026-09-08)  
**Applies to:** All OMA AI product features after Feature 002 acceptance  
**Does not:** Remove capabilities from the roadmap; change only **delivery order**

---

## Directive

**PRODUCT-FIRST / EXTERNAL-INTEGRATIONS-LAST**

Build the complete provider-neutral OMA product (modules, UX, workflows, domain logic, permissions, APIs, data models, internal state machines) **before** wiring live third-party production integrations.

External provider implementations move to one **final integration phase** after provider-neutral product features are accepted.

---

## In scope (deferred to final integration phase)

Live third-party integrations including:

- Website crawl / browser vendors
- AI providers and models
- Social publishing platforms
- External analytics providers
- Email and external notification providers (beyond Foundation recording/mail ports)
- Object storage / CDN providers (when not the internal product model)
- Other third-party production APIs or SDKs

## Out of scope of this deferral (continue now)

- Provider-neutral product specification and implementation
- Ports / interfaces and production guards
- Refusing adapters, deterministic test adapters, local fixtures
- Manual fallback paths where the product specification supports them
- UI “not connected / not configured” honesty states
- Internal platform already approved under `DEC-014`: **PostgreSQL, Redis, BullMQ** (and the modular monolith/worker architecture) — these are **not** deferred third-party product integrations

## Binding rules

1. Keep `WebsiteConnectorPort`, `AiProviderPort`, `ObjectStoragePort` / `WorkDrivePort`, `PaidMediaConnectorPort`, and related ports.
2. Production default remains **refusing** (or equivalent safe guard) until the final integration phase + closed provider decisions.
3. Tests and review may use fixtures / recording adapters only.
4. UI must show **not connected / not configured** — never pretend live integration exists.
5. **No** provider SDK, credential, live external request, or provider selection before the final integration phase.
6. Feature 002 Phase BG tasks **T200–T208** stay unchecked and excluded from Feature 002 completion.
7. `DEC-004` and `DEC-007` (and related provider DECs) remain **open** and are marked `DEFERRED_TO_FINAL_INTEGRATION_PHASE` — **not** resolved and **not** vendor-selected.

---

## Canonical product roadmap order (Foundation user scenarios)

Authority: `specs/001-oma-ai-product-foundation/spec.md` §6 (priority order).  
Feature 002 delivered the provider-neutral productization of **US-001**.

| Order | Foundation story                                                        | Product feature status                                                                                                     |
| ----- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1     | **US-001** Connect website + verified intelligence                      | **DONE** — Feature `002-brand-website-intelligence` (provider-neutral core **ACCEPTED**)                                   |
| 2     | **US-002** Evidence-backed strategy with **Organic** and **Paid** plans | **NEXT unfinished provider-neutral stage** — not started (no `specs/003-*` yet)                                            |
| 3     | **US-003** Approved plan → briefs and tasks                             | Not started                                                                                                                |
| 4     | **US-004** Production Kanban workflow                                   | Not started                                                                                                                |
| 5     | **US-005** Deliverable version review/approve                           | Not started                                                                                                                |
| 6     | **US-006** Client portal request/track                                  | Not started                                                                                                                |
| 7     | **US-007** WorkDrive sync of approved assets                            | Not started (also gated by `DEC-003` for bytes)                                                                            |
| 8     | **US-008** Paid-media activation prep                                   | Not started (also gated by `DEC-006` for live Meta)                                                                        |
| 9     | **US-009** Notifications and deep links                                 | Partial via Foundation; product expansion as needed                                                                        |
| —     | **Final integration phase**                                             | Live crawl, live AI, WorkDrive bytes, Meta, ESP, CDN/object storage, analytics — after provider-neutral product acceptance |

**Exact next unfinished provider-neutral product stage (do not start in this change):**  
`SPECIFY_003_STRATEGY_ORGANIC_PAID_PLANS` — Spec Kit feature for Foundation **US-002** (evidence-backed strategy; Organic and Paid as distinct plans under one strategy; AI proposals via port/fixture/manual only).

---

## Related documents

- Decision registry: `specs/001-oma-ai-product-foundation/spec.md` §17 (`DEC-016`, deferred tags on provider DECs)
- Ports policy: `specs/001-oma-ai-product-foundation/contracts/connector-ports.md`
- Phase BG packet: `specs/002-brand-website-intelligence/decisions/phase-bg-decision-packet.md`
- Feature 002 closeout: `specs/002-brand-website-intelligence/closeout.md`
