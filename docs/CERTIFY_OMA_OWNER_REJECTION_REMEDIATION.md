# CERTIFY_OMA_OWNER_REJECTION_REMEDIATION

**DEC-017 (2026-09-16):** This certification is **not** visual acceptance. `PREVIOUS_VISUAL_CERTIFICATIONS: SUPERSEDED`. Next visual work is Planable P1.

**Mode:** `REVIEW_FIX_AND_CERTIFY`
**Starting SHA:** `58949616b9c0a22d59ae2b00f196cea181552559`
**Branch:** `004-oma-complete-product-demo`

## Binding status (owner acceptance not auto-changed)

| State                           | Value                   |
| ------------------------------- | ----------------------- |
| OWNER_VISUAL_REVIEW             | REJECTED                |
| VISUAL_REBUILD                  | COMPLETE                |
| OWNER_REMEDIATION_CERTIFICATION | PASS                    |
| FULL_VISUAL_CERTIFICATION       | SUPERSEDED              |
| OWNER_PREVIEW                   | READY                   |
| VISUAL_ACCEPTANCE               | REJECTED (DEC-017)      |
| PREVIOUS_VISUAL_CERTIFICATIONS  | SUPERSEDED              |
| USER_ACCEPTANCE                 | PENDING                 |
| EXTERNAL_INTEGRATIONS           | DEFERRED                |
| DEMO_MODULES                    | NOT_PRODUCTION_COMPLETE |

## Owner objections answered (independent)

1. **Kanban discoverable** — Sidebar label `Tasks board`; Command Center overdue CTA; ⌘K `kanban` → board default.
2. **DnD real + persisted** — `@dnd-kit` pointer drag; drop `is-over`; reload retention; invalid transition toast; API 500 rollback.
3. **Typography loaded** — Runtime `getComputedStyle`: Inter (EN), Noto Sans Arabic (AR).
4. **IA understandable** — Grouped Main navigation; Company members; Create/search; breadcrumbs.
5. **Specialized surfaces** — stage-depth archetypes verified via testids/DOM (workboard, portfolio, composer, triage, brief, kanban, grid, dark review, chart-first, workload, settings IA).
6. **Motion/interactions** — motion.css + videos of shell/command, kanban, calendar drawer, request/brief, review, mobile.
7. **Features connected** — Campaign→Strategy, Request→Brief, Deliverables→Review, Tasks drawer relationships.
8. **Coherent product** — Inter/Noto + depth surfaces + honest demo disclosures; no external hosts in cert journey.

## Evidence

- Screenshots: `artifacts/owner-remediation-certification-004/screenshots/`
- Videos: `artifacts/owner-remediation-certification-004/videos/`
- Metadata: `.reference/004-visual-parity/ours/owner-remediation-certification/`

## Reference evidence levels (no new LIVE claimed)

| Ref       | Level                      |
| --------- | -------------------------- |
| Planable  | ARCHIVED LIVE + DOC        |
| Linear    | ARCHIVED LIVE + DOC        |
| Frame.io  | ARCHIVED/DOC               |
| Semrush   | SUBSCRIPTION_LIMITED + DOC |
| Jasper    | REFERENCE_LIMITED + DOC    |
| Workfront | ACCOUNT_LIMITED + DOC      |
| Smartly   | DOC/PUBLIC                 |

## Exact next stage

`OWNER_PREVIEW_AND_ACCEPTANCE_OMA_REMEDIATED_VISUAL_PRODUCT`

## Local gates (pre-commit)

| Gate                                          | Result                            |
| --------------------------------------------- | --------------------------------- |
| format / lint / typecheck                     | PASS                              |
| vitest (`pnpm test`)                          | 155 files / 318 tests PASS        |
| integration+security+contract                 | PASS (`pnpm test:integration`)    |
| owner-remediation-certification (en-desktop)  | 8/8 PASS                          |
| owner-rejection-kanban-core ×2 (en/ar/mobile) | 4 passed each (intentional skips) |
| owner-surface-depth                           | PASS                              |
| complete-product-demo (en-desktop)            | 2 passed                          |
| API / Worker / Web production builds          | PASS                              |
| prisma validate + clean migrate deploy        | PASS                              |
| openapi generate clean diff                   | PASS                              |
| pnpm audit:deps                               | No known vulnerabilities          |
| secret scan / no committed .env               | PASS                              |

## Videos / screenshots

- `artifacts/owner-remediation-certification-004/videos/` (6 webm)
- `artifacts/owner-remediation-certification-004/screenshots/` (21 png)
- `.reference/004-visual-parity/ours/owner-remediation-certification/`

## Final pins

- **Starting SHA:** 58949616b9c0a22d59ae2b00f196cea181552559
- **Certification / fix commits:** 406a156 → 3fabdb9 → 6c7a21d → e605862 → 0ad467c → 1f92097 → 9f54cb2 → 15eb428 (CI green) → 8921375 (docs pin)
- **Final SHA:** 892137573b267a02153dc1d444b4bf71645f4c2b
- **CI (implementation tip):** https://github.com/burhanbakri1-spec/oma-ai/actions/runs/34879015519 — success on 15eb428
- **Preview served:** 892137573b267a02153dc1d444b4bf71645f4c2b
