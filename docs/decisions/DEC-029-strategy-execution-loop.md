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

## PR 4.1: single organic plan model

- Tracks v2 is the source of truth for the organic plan. A new table, `StrategyChannelCadence`, stores channel, posts per week and formats. It replaces the legacy `channelsJson`, `formatsJson` and free-text `frequency`.
- Migration `20261122110000_strategy_channel_cadence` creates the table and backfills versions that have no v2 rows yet:
  - Legacy `pillarsJson` labels become `legacy-<n>` pillars.
  - Legacy channels become cadence rows. Posts per week is parsed from `frequency`. When nothing can be parsed, the value is 3 and the row is labelled `ASSUMPTION`.
  - The legacy columns are kept for one release. Nothing writes new pillars, channels or formats into them.
- `PUT …/plan/organic`: when `cadence` is omitted, the stored cadence is kept, so older clients and AI proposals cannot wipe it. Sending `[]` clears it. Duplicate channels return 400.
- Plan → requests:
  - Organic pillar requests come from v2 pillars (`organic:pillar:<key>`). Backfilled `legacy-<n>` pillars keep the old `organic:pillar:<n-1>` key, so re-running conversion stays idempotent.
  - Channels and formats come from cadence rows with posts per week > 0.
  - The legacy lists are read only when v2 is empty.
- Brief from strategy: channels come from cadence first.
- AI flows:
  - The plan AI (`oma.strategy_plan_generate`, prompt v2) now proposes `organic.cadence`. Null keeps the current cadence. Stored proposals from before 4.1 still validate.
  - Accepting a foundation AI proposal (`ai/propose/accept`) no longer writes the legacy organic lists. It fills v2 pillars and cadence (labelled AI_PROPOSAL / AI_ESTIMATE) only when they are empty.
- UI:
  - The legacy organic form keeps only the CTA field.
  - Cadence is edited in the plan editor.
  - The draft preview reads v2.
- KPI binding moves to PR 4.5 (scorecard), so the plan is not changed twice.
