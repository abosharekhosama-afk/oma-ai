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
  `brief.convert`, `brief.comment` (migration `20261116150100_brief_capabilities` syncs system
  profiles and backfills grants for existing memberships; it never revokes anything).
- Feature flag `BRIEF_ENTITY_ENABLED` (default on in dev/test) gates the new routes and UI.
- The direct `plan-to-requests/convert-tasks` path remains for existing data but the UI routes new
  work through briefs.

## Open for owner override

- Whether a request without a strategy (ad-hoc intake) must also pass through a brief.
- Whether self-approval is allowed for single-member brands (default: allowed, audited).

## Implementation notes (Phase 1 · PR C)

- Routes are brand-scoped: `/api/v1/brands/:brandId/briefs[/:briefId[/submit|approve|request-changes|revise|cancel|convert|comments]]`
  plus `POST /briefs/from-strategy`. Every mutation takes `row_version` (optimistic lock).
- `request-changes` requires a comment. `edit` is allowed in `DRAFT` and `CHANGES_REQUESTED` only.
- Conversion creates one `WorkTask` per deliverable with `briefId`, `briefVersionId` and
  `briefDeliverableKey`; a unique key on `(briefVersionId, briefDeliverableKey)` makes it idempotent.
  Repeating `convert` on a `CONVERTED` brief returns the existing tasks (`replayed: true`).
- Self-approval: blocked when another active member with `brief.approve` can see the brand
  (workspace admin or brand member); otherwise allowed and recorded as `selfApproval=true` + audit.
- `from-strategy` copies approved strategy text only (goals, key messages/positioning, audiences,
  channels, optional pillar → one deliverable). The result is a DRAFT; AI brief generation is a
  later PR and will follow DEC-020 (proposal + human accept).

## Implementation notes (Phase 1 · PR E — legacy backfill, §6)

- `planLegacyBrief` (`packages/domain/src/work/brief-legacy.ts`) is the pure rule set; it reads the
  `brief*` columns, falling back to the `__OMA_BRIEF_V1__` description marker when every column is
  empty, and produces one deliverable (`request-main`) from the request title/formats/channels.
- Skipped: `DONE`/`CANCELLED` requests, requests that already have tasks (converting the new brief
  would duplicate existing work), and requests with no brief text.
- `briefReadyAt != null` **and** a complete brief (objective, audience, key message, deliverable) →
  `IN_REVIEW` with a `SUBMIT` decision dated `briefReadyAt` (note `legacy_request_backfill`);
  otherwise `DRAFT`. Never `APPROVED`. `origin = legacy_request`, author = request requester,
  strategy links copied. Each created brief writes audit `brief.legacy_backfilled`
  (`beforeRef = work_request:<id>`, actor type `system`).
- Runner: `pnpm --filter @oma/db backfill:legacy-briefs [-- --tenant=<id>] [-- --apply]`. Dry run by
  default; idempotent through `Brief @@unique([tenantId, requestId])` (concurrent `P2002` → skip).
  It is a script, not a migration, so operators choose when to run it per environment.
