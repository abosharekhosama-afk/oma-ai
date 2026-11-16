# DEC-019 — Brief is an independent, reviewable entity

**Status:** `ACCEPTED_DEFAULT / OPEN_FOR_OWNER_OVERRIDE`
**Date:** 2026-11-16
**Pillar:** 1 — Strategy & planning (Workfront request/brief logic)

## Context

Today the brief is a set of columns on `WorkRequest` (`briefObjectiveEn/Ar`, `briefAudienceEn/Ar`,
`briefKeyMessageEn/Ar`, `briefReadyAt`) plus a JSON marker (`__OMA_BRIEF_V1__`) embedded in the
request description. "Ready" is computed automatically when three fields are non-empty
(`packages/domain/src/work/brief-readiness.ts`). Nobody reviews or approves a brief, it has no
versions, and `plan-to-requests/convert-tasks` turns plan rows into tasks directly.

## Decision

1. `Brief` is its own aggregate (`Brief`, `BriefVersion`, `BriefDecision`, `BriefComment`).
   A `WorkRequest` stays the intake object; a brief is the reviewed agreement on what to produce.
2. Lifecycle: `DRAFT → IN_REVIEW → APPROVED | CHANGES_REQUESTED → CONVERTED`, plus `CANCELLED`.
   `CHANGES_REQUESTED → IN_REVIEW` on resubmit. `APPROVED → DRAFT` only through `revise`, which
   creates version `n+1`; the approved version stays frozen.
3. Briefs are generated only from an `APPROVED` strategy version that is linked to an `APPROVED`
   brand profile. Generated content is a proposal (DRAFT); it is never approved automatically.
4. Conversion to `WorkTask` rows is allowed only from `APPROVED`, is idempotent per brief version,
   and stamps every task with `briefId` and `briefVersionId`.
5. Approving requires `brief.approve`; the author of the current version may not approve it when a
   second approver exists in the brand (same rule family as content approval).
6. The legacy `WorkRequest.brief*` columns stay readable during migration and are backfilled into
   `Brief` rows (`briefReadyAt != null → IN_REVIEW`, never `APPROVED`).

## Consequences

- New capabilities: `brief.read`, `brief.create`, `brief.edit`, `brief.submit`, `brief.approve`,
  `brief.convert`.
- Feature flag `BRIEF_ENTITY_ENABLED` (default on in dev/test) gates the new routes and UI.
- The direct `plan-to-requests/convert-tasks` path remains for existing data but the UI routes new
  work through briefs.

## Open for owner override

- Whether a request without a strategy (ad-hoc intake) must also pass through a brief.
- Whether self-approval is allowed for single-member brands (default: allowed, audited).
