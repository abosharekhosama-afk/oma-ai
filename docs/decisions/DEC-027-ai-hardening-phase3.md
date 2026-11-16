# DEC-027: AI hardening (Phase 3): contracts, grounding, proposals only

- Status: Accepted (Phase 3). Every default here can be overridden.
- Date: 2026-11-16
- Builds on: DEC-016 (AI honesty), DEC-024 (AI content human review gate)

## Context

Every AI call goes through `@oma/ai`, but outputs were validated against a generic
proposal schema in several places, invalid JSON was never repaired, failed runs were
not always recorded, and the generic `POST /ai/runs` endpoint accepted any use case.

## Decision (owner-approved defaults)

| #   | Topic                                     | Decision                                                                                                  |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Repair attempts on invalid JSON or schema | One repair attempt (at most two provider calls), counted against the budget.                              |
| 2   | Provider without strict `json_schema`     | Fall back to `json_object` + Zod validation + repair; do not block the provider.                          |
| 3   | No approved brand profile                 | Content and inbox drafts allowed, flagged `generic` with a warning; strategy proposals require a profile. |
| 4   | Banned claim in a variant                 | Drop the variant with a warning; refuse when none remain. Applies to inbox replies too.                   |
| 5   | Alt text                                  | Text-only in Phase 3, labelled as a draft written from the caption; vision later.                         |
| 6   | Generic `POST /ai/runs`                   | Limited to use cases with a contract and to brand-owned sources, then phased out.                         |
| 7   | Legacy strategy AI propose                | Moved to a typed contract and marked deprecated in favour of the strategy plan generator.                 |
| 8   | Cost of failed attempts                   | Counted in the USD budget; does not consume `ai_credits_per_month`.                                       |
| 9   | Stored runs with `schemaVersion=1`        | Read with a legacy parser for display only; accepting them requires regeneration.                         |
| 10  | Dead `ai` queue processor                 | **Owner override: kept in place.** Marked with a TODO; not deleted.                                       |

## PR 3.0: generic AI runs

- `/api/v1/ai/budget` and `/api/v1/ai/runs*` now run `AuthGuard` and `CapabilitiesGuard`.
  Before this change the controller had no auth guard, so every call returned 401 and the
  capability map entries for these routes were never enforced. `/api/v1/ai/status` stays public.
- `POST /ai/runs` accepts only `brand_profile_synthesis`, `evidence_summary` and
  `contradiction_analysis`, with `source_entity_type=brand_profile`. Other values return
  400 `VALIDATION_FAILED` with the allowed list.
- The source brand must belong to the active tenant (404 otherwise). `evidence_refs` must
  be evidence of that brand (400 otherwise); their excerpts are passed to the prompt.
- Accept re-checks brand ownership before writing, writes the draft and the review decision
  in one transaction, is idempotent (a repeat returns the same `draft_id`), and the draft
  carries `ai_run_id`.
- Reject is persisted: `refusalReason=HUMAN_REJECTED` and `metadata.review`. The run status
  and settled cost are unchanged so budget accounting is unaffected. Accept after reject
  and reject after accept return 409.
