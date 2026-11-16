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

## PR 3.2: unified run ledger

- New `AiRun` columns: `attemptCount`, `failureStage` (`budget|provider|parse|schema|semantic`)
  and `contractId`. Migration `20261116210000_ai_run_ledger` (additive, defaults only).
- `@oma/db` `reserveAiRun` checks the budget and persists the run as `RUNNING` with its
  reservation inside one transaction under a per-tenant advisory lock, so concurrent calls
  cannot overrun the budget. `settleAiRun` / `failAiRun` release the reservation and record
  the real cost, tokens and latency on the same row.
- Every provider call has an `AiRun` row: api structured runs, the generic `/ai/runs`
  endpoint and the brand-analysis worker. Failed attempts that reached the provider keep
  their billed cost (counted in USD, no `ai_credits` consumed).
- The budget window is the current UTC month (it previously summed every run ever).
  `RUNNING` reservations older than 15 minutes are treated as abandoned.
- `inputHash` is a hash of the actual prompt and schema. Without an explicit
  Idempotency-Key, an identical request from the same actor within 60 seconds replays
  the same run (`Date.now()` keys removed); a duplicate while running returns 409
  `AI_RUN_IN_PROGRESS`.
- Platform admin provider probes are not tenant runs and stay unlogged.

## PR 3.3: repair loop and provider capabilities

- `@oma/ai` `runStructuredCore` is the single structured-output loop for every provider
  (OpenAI Responses and Chat Completions transports). On invalid JSON or a contract
  failure it sends **one** repair round (`AI_REPAIR_ATTEMPTS`, default 1, max 2): the
  previous reply plus the validator's issues. A refusal is never repaired. Usage from all
  calls is summed, and `AiRun.attemptCount` records how many calls were made.
- Capability matrix (`PROVIDER_CAPABILITIES`): OpenAI and Grok use strict `json_schema`;
  Groq uses strict only on `openai/gpt-oss-20b|120b`, otherwise `json_object`; Gemini uses
  `json_object`. In `json_object` mode the schema is sent in the system prompt and Zod
  validates the output. `AI_STRUCTURED_OUTPUT_MODE` overrides the mode.
- If a provider rejects the schema itself (HTTP 400 mentioning `response_format`/schema),
  the call falls back once to `json_object`.
- The Groq/Gemini defaults come from provider documentation, not live calls, and should be
  confirmed with a live smoke run (PR 3.7 script).

## PR 3.4: brand grounding

- The brand context gives every citable fact a short ref id: `C1…C24` for accepted
  claims (mapped to the `InsightClaim` id) and `P-overview`, `P-tone`, `P-audiences`,
  `P-messaging`, `P-products`, `P-services` for approved profile sections. Only refs
  still present after token compaction are offered. Rejected claims never get a ref.
- Content (caption, rewrite, idea, alt, hashtags) and inbox replies now use the v2
  contract per call (`buildContractFor(kind, ctx)`), narrowed to:
  - the channel limit and requested length (over-limit text is a contract issue and is
    repaired, never trimmed). Inbox replies are capped at 1000 characters;
  - the requested language (`language` must match, and a script check rejects text in the
    other language; brand names, URLs, hashtags and mentions are ignored);
  - the refs in this brand's context. Each variant carries `factual` and `groundingRefs`.
    An unknown ref, a factual variant with no ref, or a price/percentage with no ref is a
    contract issue (repaired once, then `SCHEMA_INVALID`).
- Banned words and rejected claims: offending variants are dropped, never rewritten.
  If none remain the call is refused with `422 AI_REFUSED / BANNED_CLAIM` (inbox included,
  with `auto_sent: false`).
- Inbox language: the explicit request wins, otherwise the language of the latest
  inbound message, otherwise the brand's first language.
- No approved profile: content and inbox still run, with no refs allowed, and the
  response says `grounded: false` and marks each variant `generic: true`. Strategy
  generation (plan and the legacy propose endpoint) returns
  `403 BRAND_PROFILE_NOT_APPROVED`.
- Responses add `grounded`, `schema_version`, `grounding_refs` (resolved to the source
  claim or section) and per-variant `factual` / `grounding_refs`. Runs record
  `contractId` and `schemaVersion: '2'`. Prompt versions are bumped to `2`.
- Known risk: thin profiles give few refs, so factual copy is refused more often. That
  is intended (no invented facts), and PR 3.7 evals measure it.
