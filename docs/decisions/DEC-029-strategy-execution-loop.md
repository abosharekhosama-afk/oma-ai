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

## PR 4.2: strategy → calendar

- `buildCalendarSlots`, a pure domain function:
  - Each active cadence row (posts per week > 0) is spread evenly across each week.
  - Posts are set at local publishing hours in the brand's timezone. A second post on the same day goes to the next slot hour.
  - Formats rotate across the posts.
  - Slots go to pillars by largest deficit against `share_target_pct`. Pillars without a share split whatever is left of 100. With no shares set, all pillars weigh the same.
  - Horizon: 1–12 weeks, 4 by default. At most 200 slots; the result reports when it was truncated.
- `POST …/plan-to-requests/commit` accepts `calendar: { start_date, weeks }`:
  - Omitted: a 4-week calendar starting tomorrow, but only when the plan has active cadence and pillars.
  - `null`: turns it off.
  - Each pillar's request gets its anchor content on its first slot. Every further slot becomes its own DRAFT content item, labelled `plan-slot:*` and `pillar:*`.
  - Catalog items are spread evenly across the horizon.
  - Work is due 2 days before the first planned post, and never before the start date. This replaces the single shared due date.
  - An explicit `defaults.due_at` still wins.
- Preview returns:
  - `calendar` (posts per week, slots in the default horizon, split by pillar);
  - `default_selected` on every draft;
  - `catalog_default_selected_count`.
- Product picker:
  - 10 products, 10 services and 10 paid products are pre-selected. Products with approved media come first.
  - The rest stay listed but are only created when someone picks them by hand.
  - A commit without explicit keys creates only the pre-selected drafts.
  - `estimateCatalogContentRequests` now reports the default pick.
- UI (review → plan requests):
  - A "spread over calendar" toggle, start date and weeks, with a summary line.
  - The single due date is shown only when the calendar is off.
  - A catalog picker line with show all / show selected.

## PR 4.3: plan → brief is the only route to work

- A plan commit now creates a **Brief** for every new request (`origin: strategy`, linked to its `requestId`, idempotent per request).
  - The brief content comes from the draft: objective, audience and key message in Arabic and English; the CTA from the organic track; channels; the pillar key; and the request's due date.
  - Each calendar slot becomes a deliverable (`slot-<n>`, with channel, format, and a due date one day before the post), up to 30. Drafts without slots get a single `content` deliverable.
  - The commit response returns `created_brief_ids`.
- `plan-to-requests/convert-tasks` no longer skips the brief. It creates tasks only for legacy requests that have no brief. Requests with a brief are reported as `brief_route` or `brief_converted`. Tasks come from approving and then converting the brief.
- `GET …/versions/:versionId/execution` (`strategy.read` + `request.read`) reports, for each pillar and for catalog / paid / other:
  - requests, briefs by status, open and done tasks;
  - content as planned / draft / in review / approved / scheduled / published;
  - the pillar's target share vs its planned and published share.
- Plan content now carries a `strategy-version:<id>` label, so execution counts never mix in content from another version.
- UI: a "Plan execution" panel on the strategy overview and review pages. The commit message tells the user to approve the briefs.
- Strengthening: the Arabic text for `brand.seo.searchConsole` was copied from English, which made the base fail the i18n audit. It is now translated.

## PR 4.4: content carries strategy context; content AI is grounded in it

- `ContentItem` gets three new columns: `strategyVersionId`, `pillarKey` and `targetKeyword` (migration `20261122120000_content_strategy_context`, with an index on tenant + version + pillar).
  - Backfill: the version comes from the request's anchor content or the `strategy-version:*` label.
  - The pillar comes from slug-style `organic:pillar:*` labels. Legacy numeric keys are skipped.
- Plan commit stamps every anchor and slot post with its version and pillar. Each pillar's v2 keywords rotate across its posts, highest priority first.
- The content API returns `strategy_version_id`, `pillar_key` and `target_keyword`.
- AI generation with `content_id` loads the strategy context, only from an APPROVED version of the same tenant and brand:
  - pillar name, focus and funnel stage;
  - objective, audience and key message (brief first, then the foundation);
  - CTA and target keyword.
- The prompt gets an "approved strategy context" block outside the untrusted-input fence. A rule tells the model to serve the pillar and message and to use the keyword once, naturally. The strategy is guidance, never a source of brand facts, so grounding rules are unchanged.
- The run metadata records `strategyVersionId` / `pillarKey`. The response includes `strategy_context`.
- UI: the content detail shows a line with the pillar and keyword for strategy posts.

## PR 4.5: KPI scorecard — measurable metrics, otherwise manual

- `StrategyKpi` gets a metric binding (migration `20261122130000_strategy_kpi_scorecard`):
  - `metric` (null means manual), `targetNumber`, `period` (WEEK / MONTH / QUARTER / VERSION, a rolling window ending now; VERSION runs from approval), `scope` (STRATEGY_CONTENT = posts of this version, BRAND = all brand posts), and optional `pillarKey` / `channel` filters;
  - for manual KPIs: `manualValue`, `manualNote`, `manualValueAt`, `manualBy`.
  - The backfill parses numeric legacy `targetValue` text ("1,200", "4.5%") into `targetNumber`. Every legacy KPI stays manual.
- Measurable metrics: `posts_published`, `publish_rate` (published / planned in the window), `impressions`, `reach`, `engagements` (likes + comments + shares), `engagement_rate`, `video_views`.
  - Post metrics come from `PostMetricSnapshot` (excluding `excluded` rows), joined through `contentItemId` to content of this version.
  - No data gives `no_data`, never zero.
- `POST …/kpis` validates the binding: an unknown metric, period or scope returns 400. The version detail returns `metric`, `measurable`, `target_number`, `period`, `scope`, `pillar_key` and `channel`. Revise copies the binding.
- `GET …/versions/:versionId/kpi-scorecard` (`strategy.read`) returns, for each KPI: source, actual, progress %, and a status:
  - on_track ≥ 100%;
  - at_risk ≥ 70%;
  - behind;
  - no_data / no_target / not_recorded.
- `POST …/kpi-scorecard/:kpiId/manual` (`strategy.edit`, also allowed on APPROVED versions, because it records a result and does not edit the plan) records a manual value.
  - Audited as `strategy.kpi.manual_recorded`, with before and after values.
  - Measured KPIs return 409 `KPI_MEASURED`.
- UI: a "KPI scorecard" panel on the strategy overview. Adding a KPI with a metric or as manual is only possible on drafts. Manual values can be recorded inline.

## PR 4.6: SEO — DataForSEO behind a flag, live GSC hardening, weekly rank tracking, gaps → brief

- **DataForSEO.** `BRAND_KEYWORD_RESEARCH_MODE=dataforseo` turns it on, and only if `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` are set. Without a key the mode resolves to `manual`, and nothing is invented.
  - Volume comes from `keywords_data/google_ads/search_volume/live` and difficulty from `dataforseo_labs/google/bulk_keyword_difficulty/live`, per locale.
  - Location comes from the market (SA/AE/EG/KW/QA/BH/OM/JO/US/GB), else `DATAFORSEO_LOCATION_CODE`, else SA.
  - Metrics are labelled `EXTERNAL` / `measured: true`. A missing keyword gives nulls. Provider errors throw instead of returning numbers.
- **Search Console sync is shared** (`@oma/db` `syncBrandSearchConsole`, used by both the API "sync now" and the worker). It fixes several problems in the live path:
  - Expired access tokens are refreshed with the stored refresh token. If the refresh fails, the link goes to `NEEDS_RECONNECT` and the API returns 409 `GSC_NEEDS_RECONNECT`.
  - Each query's locale is detected from its script, instead of always being `ar`.
  - The window ends 2 days back, because GSC data lags. Up to 250 rows.
  - Provider errors are stored in `lastError`; a 401/403 → `NEEDS_RECONNECT`.
  - There is one dated snapshot per source per day. It is written atomically.
  - On OAuth, the chosen property is the one that matches the brand website, not the first site Google lists. With no verified site, the user is redirected with `gsc=no_verified_site`.
- **Weekly rank tracking.** In the worker, every 6 hours, each CONNECTED live link with no sync in over 7 days is synced (`SEO_WEEKLY_SYNC=false` turns this off; live mode only).
  - `GET /brands/:brandId/seo/rank-tracking?weeks=N` (brand.read) shows the keywords of the latest APPROVED strategy version, with:
    - the latest snapshot of each ISO week;
    - the latest position and the week-over-week change;
    - a status (top3 / top10 / striking / deep / not_ranking);
    - GSC link status.
- **Gaps → brief.**
  - `GET /brands/:brandId/seo/gaps` compares the last 28 days with the plan:
    - plan keywords that don't rank;
    - plan or unplanned queries at positions 11–30;
    - unplanned queries with ≥ 50 impressions.
  - `POST /brands/:brandId/seo/gaps/brief` (`brief.create`) turns the selected gaps into one DRAFT brief (`origin: seo`, linked to the approved version):
    - one deliverable per gap: a page refresh or an article, Website channel, due in 14 days;
    - the pages as references.
  - It goes through the normal brief approve → tasks route.
- UI: the SEO page gets a "Weekly rank tracking" table (last 4 weeks plus change) and an "SEO gaps" checklist with "Create draft brief". The brief page shows the SEO origin.

## PR 4.7: paid campaign plans, experiment results and spend

- **Flights.** `flights` is part of the paid plan (`StrategyPaidFlight`, migration `20261122140000_paid_execution`). Each flight has:
  - key, name, platform, objective and audience;
  - `start_date` / `end_date`;
  - a planned budget and currency.
  - Like cadence in 4.1, omitting `flights` in `PUT …/plan/paid` keeps the stored ones, so AI proposals and older clients cannot wipe them.
  - Validation: `FLIGHT_DATES_INVALID`, `DUPLICATE_FLIGHT_KEY`, `UNKNOWN_AUDIENCE`. Max 20.
  - Revise copies the flights.
- **Flights → campaigns.** `POST …/versions/:versionId/paid-flights/campaigns` (`strategy.read` + `campaign.create`) works on APPROVED versions only. It creates one DRAFT `PAID` campaign per flight, with the dates, budget, platform channel and a `strategy-flight:<version>:<key>` link. It is idempotent through `StrategyPaidFlight.campaignId`.
- **Experiments after approval.** `POST …/experiments/:experimentId/status` (`strategy.paid.edit`) works on APPROVED versions only. Drafts keep editing through the plan.
  - Transitions: PLANNED → RUNNING|CANCELLED, RUNNING → CONCLUDED|CANCELLED.
  - CONCLUDED needs `result_summary`. The winner and per-variant results must use known variants.
  - Stored: `startedAt`, `endedAt`, `statusUpdatedAt`/`By`, `resultsJson`.
  - Each change is audited as `strategy.experiment.updated` with before and after values. `GET …/experiments/:id/history` returns that trail.
- **Spend.** `PaidSpendEntry` rows are unique per tenant, brand, platform, date, flight key and source.
  - `POST /brands/:brandId/paid-spend` takes manual entries. `POST /brands/:brandId/paid-spend/import` takes CSV (both `strategy.paid.edit`).
  - The CSV parser:
    - matches ads-manager header aliases (Day / Reporting starts, Amount spent (SAR), Link clicks, …);
    - handles `,` `;` and tab separators and quotes;
    - reads YYYY-MM-DD, YYYY/MM/DD and DD/MM/YYYY dates;
    - uses default platform and currency when those columns are missing.
  - Import is all-or-nothing: any bad row returns line-numbered errors and nothing is saved. Same-day rows are summed. Re-importing updates rows and never duplicates them.
  - A flight key must belong to an approved version.
  - `GET /brands/:brandId/paid-spend` (analytics.read) returns rows and totals per platform.
- **Pacing.** `GET …/versions/:versionId/paid-execution` (`strategy.read`) returns, for each flight:
  - actual spend, impressions, clicks and conversions;
  - linear expected spend to date and pacing %;
  - a status: not_started / on_pace (±15%) / under- or overspending / ended / no_budget.
  - It also returns experiments with results, plus planned and actual spend and spend not tied to a flight.
- UI: a flights table in the paid plan editor. On approved versions, a "Paid execution" panel on the overview shows pacing, a "create draft campaigns" action, experiment start / record result / cancel, and CSV import.

## PR 4.8: Meta Ads insights, read-only

- **Read-only by design.** A separate Meta OAuth asks for `ads_read` only. It is separate from the page-publishing connection, because page tokens cannot read ad accounts.
  - OMA never creates, edits, pauses or funds ads. There is no write endpoint, and the client has no write methods.
- `META_ADS_MODE=disabled|fixture|live`. The default is **disabled**.
  - `live` also needs `META_APP_ID` / `META_APP_SECRET`.
  - `fixture` follows the fixtures rule from 4.0 and is never on in production.
- **Models** (migration `20261122150000_meta_ads_insights`):
  - `MetaAdsLink` (one ad account per brand; the long-lived ≈60-day user token is encrypted; status PENDING_ACCOUNT / CONNECTED / NEEDS_RECONNECT / FIXTURE);
  - `MetaAdsOAuthState`;
  - `PaidSpendEntry.externalCampaignId`.
- **Routes:**
  - `GET /brands/:id/meta-ads` (analytics.read) returns the status, `read_only: true` and the scopes;
  - `POST …/meta-ads/oauth/start` → `GET /meta-ads/callback` → `GET …/meta-ads/accounts` → `POST …/meta-ads/account`;
  - `POST …/meta-ads/sync` and `POST …/meta-ads/disconnect` (forgets the token locally).
  - All writes need `strategy.paid.edit` and are audited (`paid.meta_ads.*`).
- **Sync** (`@oma/db syncBrandMetaAds`, shared by the API and the worker):
  - Pulls daily campaign-level insights (spend, impressions, clicks, purchase/lead/registration conversions) with pagination.
  - A campaign is tied to a flight when its name contains `[flight-key]` or equals the flight name. Otherwise its spend stays unassigned.
  - Rows are aggregated per day and flight. The sync window is replaced on every run, so Meta's restatements win.
  - An expired token or a 401 / code 190 / code 200 → NEEDS_RECONNECT.
  - The worker syncs CONNECTED live links daily (last 7 days).
- **No double counting.** When META_* rows exist for the same platform, day and flight, CSV/manual rows for that key are left out of pacing and spend totals (`preferApiSpend`).
- UI: a Meta Ads card in the "Paid execution" panel (connect read-only → pick account → sync / disconnect). It is hidden when the mode is disabled.

## PR 4.9: one workspace — three tabs, one AI assistant

- The strategy sub-nav is now three tabs: **Plan** (overview, foundation, organic, paid, evidence as secondary chips),
  **Execution** (new `/execution` page) and **Review & versions** (review, versions). Every old route keeps working
  and highlights its tab; no URL was removed (`apps/web/src/lib/strategy-tabs.ts`).
- **Execution** always targets the latest **APPROVED** version (from the versions list), even while a newer draft is
  being edited — plan requests, execution/calendar, KPI scorecard (read-only), paid execution (flights, experiments,
  spend, Meta Ads). These panels were removed from Overview and Review, which now link to the tab instead.
- The draft KPI editor stays on Overview (it edits the plan); the scorecard on Execution records results.
- **One AI assistant**: `StrategyAiAssistant` renders only on the Plan overview (`#strategy-ai-assistant`) for
  DRAFT/IN_REVIEW versions. Foundation, organic, paid and review pages show a link to it instead of their own copy.
  Honest limitation: the plan editor's inline "propose plan" action (4.1) remains in the editor — it is a section
  action on the same plan model, not a second assistant, and moving it would mean re-wiring apply/diff state.
- No API or schema change.

## PR 4.10: AI monthly review → new draft version

- `GET …/versions/:id/monthly-review?month=YYYY-MM` (default: last full month) returns **measured** findings for an
  APPROVED version: KPI scorecard status (4.5), cadence delivery per channel (published vs `posts_per_week × days/7`),
  pillar share drift (>15 pts), paid flight pacing (4.7/4.8) and completed experiments. Findings are deterministic
  (`@oma/domain` `monthlyReviewFindings`); the AI never produces the numbers.
- `POST …/versions/:id/monthly-review` (`strategy.edit`), idempotent per version + month (`StrategyMonthlyReview`):
  - nothing actionable → record `NO_CHANGES`, no draft;
  - otherwise **revise → new DRAFT** (refused with 409 `OPEN_DRAFT_EXISTS` while another draft/review is open), then
    the existing plan AI (`proposePlan`) runs on the draft with the actionable findings as an extra grounded input
    (`reviewFindings`, internal only — never read from the request body). Status `PROPOSED` with the run id.
  - AI unavailable/refused/invalid → status `DRAFT_ONLY` + `ai_error`; the draft is a plain copy and the findings guide
    a manual edit (honest manual journey, no template overwrite).
  - The proposal is **never auto-applied**: a human applies it with the existing `plan/ai/accept` and the draft goes
    through normal submit/approve. Audited as `strategy.monthly_review.created`.
- `GET …/strategies/:id/monthly-reviews` lists history. UI: monthly review panel on the Execution tab (4.9).
- Not done (remaining): an automatic month-start reminder/notification; reviews are user-triggered for now.
- Migration `20261122160000_strategy_monthly_review`.
