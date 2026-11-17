# Research — 005 Operational Closure

**Date:** 2026-11-17
**Status:** Sufficient for task decomposition

## Repository facts (004 branch)

| Capability               | Location                                                                              | Closure note                                               |
| ------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Live crawl               | `packages/domain/src/brand/website-connector-factory.ts`, `live-website-connector.ts` | Default `live` when not fixture                            |
| Catalog observations     | `extraction.service.ts` `persistCatalogObservations`                                  | Must stay regression-covered                               |
| Analysis enqueue         | `ingestion.processor.ts` `enqueueBrandAnalysis`                                       | After profile draft                                        |
| Plan catalog             | `strategy-plan-requests.service.ts` `loadCatalogOfferings`                            | **Gap:** profile sections only — 005 adds sync + fallback  |
| Profile sections catalog | `profile-draft.service.ts`                                                            | Pulls from observations, not full discovery media richness |
| Catalog reimport         | `catalog.processor.ts` `catalog.reimport`                                             | Operational path for legacy scans                          |

## Reference document alignment (Arabic marketing refs §10)

- External refs **not connected** — 005 does not change that for Semrush/Smartly.
- OpenAI **optional ops** — aligned with `AI_LIVE_ENABLED` pattern.
- Workfront/Frame.io **ops path** partially via plan-requests + deliverables — 005 stops at work request commit.

## Brand-analysis contract audit (T021)

`BRAND_PROFILE_FIELD_KEYS` covers overview-like fields + `catalog.products` / `catalog.services`. **Gaps vs Jasper-like narrative spec:** no dedicated `brand.overview` / `brand.positioning` keys (mapped via `brand.description` + `brand.messaging`); no separate `competitors` or `content_pillars` fields (strategy-owned). **Apply paths:** proposals for listed keys only; unlisted Jasper sections remain manual or strategy slice.

## Open unknowns

| ID       | Unknown                                       | Default                                                                   |
| -------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| R-005-01 | CI allowlist URL for live crawl               | Use same host as existing security crawl tests or env `CLOSURE_PROOF_URL` |
| R-005-02 | Approve-time auto catalog vs explicit refresh | **DP-005-001 B** — refresh + approve materialization                      |

## References

- [`spec.md`](./spec.md)
- [`docs/PRODUCT_DELIVERY_SEQUENCING.md`](../../docs/PRODUCT_DELIVERY_SEQUENCING.md)
- [`specs/002-brand-website-intelligence/spec.md`](../002-brand-website-intelligence/spec.md)
- [`specs/003-strategy-organic-paid-plans/spec.md`](../003-strategy-organic-paid-plans/spec.md)
