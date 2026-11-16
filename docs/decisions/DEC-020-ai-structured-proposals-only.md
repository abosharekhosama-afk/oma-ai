# DEC-020 — AI output is schema-bound and starts as a proposal

**Status:** `ACCEPTED_DEFAULT / OPEN_FOR_OWNER_OVERRIDE`
**Date:** 2026-11-16
**Pillar:** 2 — Structured AI outputs

## Decision

1. Every AI use case that writes into a product entity has a strict, versioned Zod schema. The JSON
   Schema sent to the provider is derived from the same Zod object (`z.toJSONSchema`, Zod 4), so the
   validator and the provider contract cannot drift.
2. Prompts receive only approved brand context (approved profile, approved catalog). Outputs are
   post-validated: product references must resolve to the approved catalog, evidence references
   must exist, banned phrases are rejected, and every item carries an info class
   (`Fact | Inference | Proposal`) and a source label.
3. AI never changes an `APPROVED` entity and never sets any approval state. Output lands as a
   draft or proposal that a human can edit, accept, or reject.
4. AI-generated content must receive a human approval before it can be scheduled, even when the
   brand approval policy is `NONE`. Enforcement ships with the approval-policy work (Phase 2);
   Phase 1 records origin (`origin = AI_ASSISTED`, `aiRunId`) on every entity it creates so the rule
   can be enforced without backfill.
5. When AI is unavailable, deterministic generation produces the same schema, labelled
   `source = DETERMINISTIC` so the UI never presents a template as model output.

## Open for owner override

- Allowing `NONE` policy brands to auto-schedule AI content (default: not allowed).
