# DEC-028 — SEO visibility, Search Console, and keyword research ports

**Status:** APPROVED (implementation `cursor/seo-visibility-full-f9b2`)

## Scope

- On-site SEO audit after each brand scan (CRAWL metric source).
- `SearchConsolePort`: `fixture` (default), `live` (OAuth + API), `disabled`.
- `KeywordResearchPort` extension via `BRAND_KEYWORD_RESEARCH_MODE=external_fixture|manual`.
- APIs under existing brand routes + `GET /api/v1/analytics/seo`.
- UI: `/app/brands/:brandId/seo`.

## Non-goals (this slice)

- Live Semrush/DataForSEO SDK (future `external_live` adapter).
- Lighthouse/CWV lab runs on worker.
- Autonomous SEO “fixes” without human approval.
