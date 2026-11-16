# DEC-021 — Strategy tracks v2 and a pluggable research source

**Status:** `ACCEPTED_DEFAULT / OPEN_FOR_OWNER_OVERRIDE`
**Date:** 2026-11-16
**Pillar:** 1 — Strategy & planning (Semrush analysis logic, Smartly paid logic)

## Decision

1. Generating a plan from an `APPROVED` brand profile splits it automatically into two tracks:
   - **Organic:** content pillars, SEO keywords with search intent, content gaps.
   - **Paid:** platform budget allocation, audience targeting, A/B experiments.
     The paid track is produced only when paid planning is enabled for the version.
2. These are normalized child tables of `StrategyVersion` (`StrategyContentPillar`,
   `StrategySeoKeyword`, `StrategyContentGap`, `StrategyPaidAllocation`, `StrategyPaidAudience`,
   `StrategyExperiment`), copied on revise/clone and frozen with the version on approval.
3. Keyword volume/difficulty and competitor data come through a `StrategyResearchPort`. The only
   adapters now are `manual` (user input) and `ai_estimate` (model estimate). Every metric stores
   its `source` and is labelled in the UI; estimates are never shown as measured data.
   A live provider (Semrush, DataForSEO, …) is a later adapter and needs its own decision.
4. Allocation shares per version must sum to 100 when any allocation exists; experiments need a
   hypothesis, a variable, at least two variants and a primary metric.

## Open for owner override

- Choice and timing of a live SEO data provider.
- Currency handling for multi-market budgets (default: the version's single `budgetCurrency`).
