# Visible Product Experience Rebuild — Gap Matrix (Feature 002)

**Phase:** `REBUILD_VISIBLE_PRODUCT_EXPERIENCE_002`  
**Baseline SHA (pre-rebuild):** `980a83c6273dc70bf0ba6451e5ffbcd7fbe5249e`  
**Mode:** IMPLEMENT — product clarity and visual coherence against DEC-013 reference *roles* (pattern study only; no copied assets/branding).

## Reference authority (applied, not claimed as live parity)

| Reference | Authority domain | Claim ceiling |
| --- | --- | --- |
| Linear | Shell density, navigation, panels, calm motion | Pattern-informed OMA adaptation |
| Planable | Review/approval clarity, status visibility | Pattern-informed OMA adaptation |
| Semrush | Website intelligence hierarchy, coverage, evidence tables | Pattern-informed; paid surfaces stay DOCUMENTATION-ONLY where blocked |
| Jasper Brand IQ | Brand profile organization | `REFERENCE_LIMITED` / DOC_VERIFIED only |
| Frame.io | Version compare, review history, side panels | Pattern-informed for those surfaces only |

`AUTHENTICATED_REFERENCE_PARITY` remains **PARTIAL**. No live crawl/AI.

## Executive gaps (runtime product, not route existence)

| ID | Area | Current evidence | Reference authority | Required OMA behavior | Classification | Implementation target | Test/proof |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VP-001 | First screen after Owner login | Single Brand Intelligence card + count; no portfolio, review queue, or next actions | Linear home density + Semrush “what needs attention” | Product landing: summary metrics, brands needing action, recent activity, clear CTAs | REBUILD | `apps/web/.../app/page.tsx` | Playwright owner login → landing asserts portfolio + needs-review; screenshot |
| VP-002 | Brand portfolio scanability | Flat list: name, status, URL only | Semrush project list density | Table/portfolio rows: website, scan, profile version, review state, updated, primary action | REBUILD | brands list + list API enrichment | Visual table + E2E brand select from UI |
| VP-003 | Brand workspace coherence | Tabs exist but header lacks status trail | Linear workspace + Planable context | Header with status chips + sticky tab strip; same chrome across tabs | PARTIAL→MATCH | `brand-workspace-shell.tsx` | Navigate tabs; shell unchanged; screenshot |
| VP-004 | Scan progress readability | Progress + counts present; weak hierarchy | Semrush crawl progress | Stat strip, timeline, recovery CTAs without JSON | PARTIAL | scan detail page + CSS | Visual scan SUCCEEDED/PARTIAL |
| VP-005 | Evidence inspectability | Side panel exists | Frame.io + Semrush evidence | Provenance chips + drawer; not full-page dump | PARTIAL | evidence components | Open evidence panel E2E |
| VP-006 | Intelligence editor clarity | Sections exist; weak fact vs inference | Jasper DOC patterns | Provenance badges, missing required, AI unavailable | PARTIAL | profile UI | Visual profile draft |
| VP-007 | Design system density | Large padding, sparse cards, purple soft look | Linear density | Unified tokens, denser shell, status chips, tables, skeletons | REBUILD | tokens + globals | Visual before/after |
| VP-008 | Product clarity for first-time user | User must infer journey | Spec FR journeys | Copy + landing explain connect → scan → discover → review → approve | REBUILD | i18n + landing | Owner preview judgment |
| VP-009 | Empty/dead ends | Onboarding Option A exists | DEC-015 | Keep Option A; no blank shell | MATCH (preserve) | onboarding | E2E onboarding |
| VP-010 | EN/AR RTL + responsive | Partially covered | Spec invariant | 1440/1024/390 + AR RTL | PARTIAL | CSS + E2E | responsive + i18n E2E |

## Out of scope (unchanged)

- Live crawl provider, live AI, vendor/model selection
- Closing DEC-003–DEC-012
- Feature 003, PR, merge to main
- Claims: LIVE-INTEGRATION READY, PRODUCTION LAUNCH READY, USER ACCEPTANCE PASSED

## Visible surfaces closure (post-accd45d)

Implemented remaining UI depth on Feature 002 branch (no live crawl/AI):

- Discovery → evidence side panel (pages + products via real evidence APIs)
- Scan phase trail, failure/cancel remediation copy, scan history on brand overview
- Approved immutable banner; compare against version picker (`against` query)
- Notification localized labels + mark-read (`POST /api/v1/notifications/:id/read`)
- Members capability profile assign UI; permission-denied i18n
- Targeted E2E: `tests/e2e/brand-visible-surfaces-002.e2e.ts`

Still deferred / not claimed: DEC-003–012 live providers, Feature 003, USER ACCEPTANCE, LIVE-INTEGRATION READY.
