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

## PR 3.5: typed call sites

- **Brand analysis** (the worker and generic `/ai/runs`) uses the v2 `brand.analysis`
  contract per call (`brandAnalysisContractFor(evidenceIds)`). Fields come from a closed
  list, confidence is required, facts must cite evidence, and any evidence id the model was
  not given is rejected (repaired once). Runs record `contractId: brand.analysis` and
  `schemaVersion: '2'`. Prompt versions: synthesis 3, summary/contradiction 2.
- **Legacy strategy propose** uses `strategy.foundation` v2 with the version's tracks:
  a disabled track must be `null`. Accept copies the typed lists (`foundation.goals`,
  `keyMessages`, `constraints`, `organic.pillars/channels/formats`,
  `paid.campaignObjectives`) directly. The old `pick()` + sentence-splitting regex is
  gone. The endpoint stays deprecated in favour of the strategy plan generator.
- **v1 runs are display-only** (#9): accepting a stored v1 proposal (strategy propose or
  generic runs) returns `409 CONFLICT_STATE` with `LEGACY_PROPOSAL, regenerate: true`.
  v1 rows are still readable.
- **Removed** the hand-written v1 JSON schemas `proposalJsonSchema()` and
  `contentGenerationJsonSchema()`. The v1 Zod `proposalSchema` stays only to read legacy
  rows. `@oma/ai` no longer defaults to v1 validation: with no explicit contract it uses
  `brand.analysis` v2 (`defaultStructuredContract`), and the success result exposes
  `output` only.
- The admin AI probe uses the v2 `content.variants` contract.
- `apps/worker/src/processors/ai.processor.ts` is untouched and kept (owner override).
  Its `adapter.generate()` path now validates against `brand.analysis` v2.

## PR 3.6: draft-only invariant

- `assertAiWriteTarget` (domain `ai/write-guard.ts`) defines the only places AI output may
  land: the `AiRun` row, a `DRAFT`/`NEEDS_REVIEW` profile version, `PENDING` insight
  claims, a `DRAFT` strategy version (only through a human accept), and `DRAFT` content.
  Anything else gets `409 CONFLICT_STATE / AI_WRITE_FORBIDDEN`.
- Accept and reject on generic `/ai/runs` and on legacy strategy propose require a
  signed-in person (`assertHumanActor` → `403 HUMAN_ACTOR_REQUIRED`). Each writes an
  `AuditEvent` in the same transaction (`ai.run.accepted|rejected`,
  `strategy.ai_proposal_accepted|rejected`) with `afterRef: ai_run:<id>`. The plan accept
  already audited through `guardedWrite`.
- Strategy accept re-checks inside the transaction that the version is still `DRAFT`.
- Brand analysis worker: locks the profile row inside the write transaction and re-checks
  it is still a draft. If a person approved it while the model was running, nothing is
  written: the run keeps the paid proposal, and the scan is marked
  `SKIPPED / APPROVED_VERSION_IMMUTABLE`. AI-written sections carry provenance in
  `sections.ai_analysis` (`run_id`, `origin: AI_PROPOSED`, `fields`).
- Deviation from the plan: brand analysis still merges its proposal into the draft's
  sections instead of a separate proposal blob, because the profile review UI edits
  those sections directly and approval is the human gate. Changing that is UI work and is
  left for later.
- Static test `tests/unit/ai-draft-only-invariant.test.ts` scans AI-only modules and the AI
  methods of mixed services for Prisma `data:` blocks that set `APPROVED`, `SUPERSEDED`,
  `PUBLISHED`, `SCHEDULED` or an accepted claim, and checks the guards are called.

## PR 3.7: AI evals

- `tests/ai-evals` has 26 deterministic cases. 15 are golden: every v2 contract (caption,
  rewrite, idea, alt, hashtags, inbox, brand analysis, strategy foundation) in EN and AR,
  including recorded repair cases. 10 are prompt injection: revealing the prompt with an
  invented ref, a banned guarantee in inbox, switching an AR request to English, an
  uncited 70% discount, an extra `debug` key, an instruction hidden in a hashtag, an
  unknown evidence id, an invented field, and filling a disabled paid track. 1 is a
  documented known gap.
- The cases run through the production prompt builders, contracts, `runStructuredCore`
  and moderation, with no network. They are part of `pnpm test` (the vitest include now
  has `tests/ai-evals`). CI fails if final validity < 100%, any banned claim leaks, any
  non-gap injection gets through, or the repair rate reaches 50%.
- Current numbers on the recorded set: first-pass validity 0.8, final validity 1.0,
  repair rate 0.2, banned leaks 0, injection blocked 1.0, known gaps 1.
- Known gap: a poisoned page cited by its own real evidence id passes the contract. Only
  human review of the PENDING claim stops it, which is the draft-only invariant from
  PR 3.6.
- `scripts/ai/ai-eval-live.ts` (`pnpm ai:eval:live`) runs the same cases against the
  configured provider. It refuses to run unless `AI_LIVE_ENABLED=true`, never runs in CI,
  and reports validity, repair rate, leaks, injection markers followed, and tokens. It was
  checked locally against a fake endpoint only; no live run was made.
