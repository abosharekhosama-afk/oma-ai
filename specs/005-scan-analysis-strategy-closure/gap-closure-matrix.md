# Gap closure matrix — Report 2026-11-17 → Feature 005

Maps gap report themes to spec/plan/tasks (no design work).

| # | Gap (report) | Closure owner | Primary tasks | Done when |
| - | ------------ | ------------- | ------------- | --------- |
| G1 | Worker+Redis not deployed | WS-OPS | T001–T004, T002 | Queue consumer + checklist CHK010 |
| G2 | Scan stalls / no honesty | WS-SCAN-OBS | T011–T012 | `stalled` flag + coverage fields |
| G3 | Weak extraction / missing media | WS-EXTRACT | T010, T014 (existing domain/worker) | Reimport + regression tests green |
| G4 | AI NOT_CONFIGURED | WS-AI | T020–T024 | Test adapter path + manual path both pass |
| G5 | Proposals not applied to all fields | WS-AI | T021–T022 | Contract fields apply API-complete |
| G6 | Profile catalog empty | WS-CATALOG-SYNC | T030–T033 | Approved sectionsJson.catalog populated |
| G7 | Plan-requests catalog 0 | WS-CATALOG-SYNC | T034–T035 | SC-SAS-002; optional `discovery_fallback` |
| G8 | Strategy without profile link | WS-STRATEGY-LINK | T036 | Gate integration test |
| G9 | No E2E real site | WS-PROOF | T040–T042 | CHK015 |
| G10 | Semrush live | Phase BG | T301 | **Out of 005** — manual competitors OK |
| G11 | WorkDrive generate | Phase 5 | T050 | Only DP-005-002 B |
| G12 | Backfill old brands | WS-EXTRACT | T014 + optional backfill endpoint in plan Phase 1 | Reimport documented per brand |

## Explicit non-goals (unchanged)

- Scan/analysis **visual** redesign
- Planable DEC-017 owner visual acceptance
- Live Semrush/Smartly/Meta in CORE 005