# SEO & visibility (OMA)

**Decision:** [DEC-028](./decisions/DEC-028-seo-visibility-ports.md)

OMA combines three evidence layers for promotion and organic visibility. Every number names its **metric source** so fixture data is never mistaken for live Search Console.

## 1. On-site SEO audit (automatic after scan)

After each successful brand **website scan** (ingestion job), the worker runs `runSeoAuditForScan`:

| Input | Source |
|-------|--------|
| Page URL, HTTP status, title, classification | `DiscoveredPage` |
| Meta description, H1, noindex, canonical, text length | `EvidenceExcerpt` HTML (parsed, no browser) |

**Outputs:** `BrandSeoAudit` (score 0–100) + `SeoFinding` rows (per page, code, severity).

**Common finding codes:** `SEO_TITLE_MISSING`, `SEO_META_DESC_MISSING`, `SEO_H1_MISSING`, `SEO_NOINDEX`, `SEO_THIN_CONTENT`, `SEO_DUPLICATE_TITLE`, `SEO_PRODUCT_NO_DESCRIPTION`, …

**API:** `GET /api/v1/brands/:brandId/seo/health?scanId=` (optional scan id; default = latest audit).

## 2. Google Search Console port

| `BRAND_GSC_MODE` | Behaviour |
|------------------|-----------|
| `fixture` (default) | Sample queries; safe for dev/CI |
| `live` | OAuth + Search Analytics API |
| `disabled` | Empty / not configured |

**Connect (production):**

1. Set `GOOGLE_GSC_CLIENT_ID`, `GOOGLE_GSC_CLIENT_SECRET`, `BRAND_GSC_MODE=live`.
2. `POST …/seo/search-console/oauth/start` → user authorizes Google.
3. Callback stores encrypted tokens on `BrandSearchConsoleLink`.
4. `POST …/seo/search-console/sync` → writes `KeywordRankObservation` (query, position, clicks, impressions, `source`).

## 3. Keyword research port

| `BRAND_KEYWORD_RESEARCH_MODE` | Behaviour |
|-------------------------------|-----------|
| `external_fixture` (default) | Deterministic volume/difficulty; `source: EXTERNAL` |
| `manual` | No invented metrics |

**API:** `POST /api/v1/brands/:brandId/seo/keywords/research` with `{ keywords: [{ keyword, locale }] }`.

Use results in strategy organic keywords with explicit `EXTERNAL` / `MANUAL` labels (DEC-021).

## 3b. Organic strategy bridge

**Domain:** `packages/domain/src/seo/strategy-bridge.ts` maps crawl `SeoFinding` rows → `content_gaps` and GSC `KeywordRankObservation` (+ optional research metrics) → `seo_keywords`.

| API | Purpose |
|-----|---------|
| `GET /api/v1/brands/:brandId/seo/strategy-proposals` | Preview proposal rows + context badge (score, scan, query count) |
| `POST …/strategies/:strategyId/versions/:versionId/plan/organic/merge-seo` | Merge selected `proposal_ids` into the draft organic plan (deduped, tenant-scoped) |

UI: organic plan editor → **Import from SEO** (checkboxes, explicit apply — no auto-approval).

## 4. Analytics aggregate

**API:**

- `GET /api/v1/brands/:brandId/seo/analytics?period=7|30|90`
- `GET /api/v1/analytics/seo?brandId=&period=` (requires `analytics.read`)

Returns: latest **site health score**, GSC query table, totals (clicks, impressions, published OMA posts in period).

## 5. Product UI

- Route: `/app/brands/:brandId/seo`
- Sub-nav: Evidence → **SEO & visibility** (EN/AR)

## End-to-end flow

```text
Connect website → Start scan → Crawl + extract → SEO audit persisted
       → (optional) Connect GSC → Sync queries
       → View SEO page + analytics/seo
       → Feed keyword research into organic strategy (manual/API)
```

## What this does not do (yet)

- Live Semrush / DataForSEO SDK (`external_live` adapter).
- Lab Lighthouse / Core Web Vitals on worker.
- Auto-fix or auto-publish without human approval.