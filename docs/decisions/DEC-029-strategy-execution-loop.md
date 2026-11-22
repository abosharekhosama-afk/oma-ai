# DEC-029: Strategy execution loop (Phase 4)

Status: accepted (owner, 22/11/2026). Implemented as stacked PRs 4.0 to 4.10.

## Why

The strategy module collected plan data but nothing used it after approval. Plan to requests
read the legacy organic pillars and ignored the v2 plan. No KPI was measured. Paid stayed a
document, and default SEO numbers were sample data that looked measured.

## Owner defaults (all recommended defaults accepted)

1. Keyword data: DataForSEO behind a flag. Manual until a key is configured.
2. Ad platforms: Meta, read only. OMA never creates ads or changes budgets.
3. Work from a plan is created only through briefs. Direct plan-to-request creation stops.
4. Catalog products in a plan are picked by hand, 10 by default.
5. Legacy v1 track fields are migrated to v2 and hidden in the UI. Columns stay one release.
6. Experiments: status and results can be updated after approval, with an audit trail.
7. KPIs bind to measurable metrics. Anything else is entered manually and labelled manual.
8. Sample (fixture) data is off in production.

## PR 4.0: data honesty

- New `StrategyDataSource` value `FIXTURE`. Fixture keyword metrics are `measured: false` and
  labelled FIXTURE. Only a measured provider may label metrics `EXTERNAL`.
- Search Console impressions, clicks and position are stored in their own columns
  (`gscImpressions`, `gscClicks`, `gscPosition`) and are never written into `monthlyVolume`.
- `seoFixturesAllowed`: fixtures are on in dev/test and off when `NODE_ENV=production`,
  unless `SEO_FIXTURES_ALLOWED=true`. Unset modes default to `disabled` / `manual` in
  production. `connect-fixture` returns 409 `SEO_FIXTURES_DISABLED` when fixtures are off, and
  the SEO page hides the button.
- Route fixes found while testing: `POST .../plan/organic/merge-seo` and
  `GET /api/v1/analytics/seo` had no capability mapping (403 for everyone). Search Console
  sync, keyword research and merge-seo now return 200.
- Migration: `20261122100000_strategy_data_honesty`.
