# OMA × Planable — R2–R6 Final Gap Ledger

## Gate snapshot

| Gate                                    | Value         |
| --------------------------------------- | ------------- |
| Accessible OMA screen coverage          | 100.0%        |
| Critical interaction coverage           | 100.0%        |
| Overlay coverage                        | 100.0%        |
| P0                                      | 0             |
| P1                                      | 0             |
| Unexplained professionalism P2          | 0             |
| Broken images                           | 0             |
| Overlap/clipping/overflow               | 0 / 0 / 0     |
| Critical console / hydration / next-dev | 0 / 0 / false |

## Remaining limitations (not automatic PASS)

1. Planable **Composer** live — `REFERENCE_UNAVAILABLE` (read-only). Documented adaptation only.
2. Some OMA-only production surfaces have no Planable twin — verdict `OMA_ADAPTATION`, not MATCH.
3. Full video proofs for Kanban DnD / review decision dialogs rely on Playwright e2e + ordered frames; Owner may request additional live video during visual review.

## Status labels — SUPERSEDED by Owner pixel-level rebuild (2026-10-01)

Owner revoked visual acceptance of the R2–R6 candidate. Canonical visual method is now
`PIXEL_LEVEL_REFERENCE_PARITY`. See `docs/OMA_PLANABLE_PIXEL_PARITY_GAP_LEDGER.md`.

- Candidate SHA at revocation: `e576570631b948c11b8a0a57d0d83614abd9e765`
- R1_RENDER_INTEGRITY: historical technical PASS only (not visual acceptance)
- R2_SHARED_COMPONENT_PARITY: REVOKED_BY_OWNER
- R3_SHELL_HIERARCHY_PARITY: REVOKED_BY_OWNER
- R4_PLANNING_PARITY: REVOKED_BY_OWNER
- R5_PRODUCTION_REVIEW_PARITY: REVOKED_BY_OWNER
- R6_REMAINING_SURFACE_PARITY: REVOKED_BY_OWNER
- FILTER_SHEET_JOURNEY: functional historical PASS only
- R2_R6_CI: historical green only
- OMA_PLANABLE_FORENSIC_PARITY_REBUILD: NOT_PASS
- REAL_RENDERED_VISUAL_PARITY: NOT_PASS
- OWNER_VISUAL_REVIEW: REJECTED
- VISUAL_ACCEPTANCE: REJECTED
