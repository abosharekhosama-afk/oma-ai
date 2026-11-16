# DEC-024: AI-generated content needs a human review before scheduling, under every policy

**Status:** `ACCEPTED_DEFAULT / OPEN_FOR_OWNER_OVERRIDE`
**Date:** 2026-11-16
**Pillars:** 2 (structured AI output) and 3 (Planable W2). Builds on DEC-020 (AI output is
always a proposal).

## Context

AI caption and idea generation (`/brands/:id/ai/generate`, captions, hashtags) returns text with
a `run_id`. The composer then saved that text like any other text. Under approval policy `NONE`
or `OPTIONAL`, AI copy could therefore reach a social network without anyone reading it.

## Decision

1. **Provenance.** `ContentItem` stores `aiAssisted`, `aiRunIds` (latest last, at most 20),
   `aiReviewedAt` and `aiReviewedBy`.
   - Create and update accept `ai_run_ids`. Every id must be a `SUCCEEDED` `AiRun` of the same
     workspace; otherwise the API returns 400.
   - The composer sends the run id of every live AI proposal it applies. Template text has no run
     id and is not AI output.
2. **Gate.** An AI-assisted post with no review gets the readiness blocker `AI_REVIEW_REQUIRED`,
   under **every** policy, including `NONE`. It blocks:
   - `schedule`, `enqueue`, `publish-now` and `mark-published`;
   - schedule-on-approval;
   - the publish worker, which skips the post with a visible reason and never claims its targets.
3. **What counts as a review.**
   - `POST /content/:id/ai-review` (capability `content.approve`). It works under every policy,
     records a `ContentApprovalEvent` `AI_REVIEW`, and writes the audit event `content.ai_reviewed`.
   - The final approval of an approval round (REQUIRED or Multi-Level).
4. **What clears a review.**
   - Applying new AI output (an update with `ai_run_ids`) clears it.
   - Human edits do not; `aiAssisted` stays true for the life of the post.
   - Copies (duplicate, copy-to, detach, ungroup) stay AI-assisted and need their own review.
5. **Self-review is allowed.** A person who applied the AI text and holds `content.approve` may
   confirm the review. It is always audited.

## Consequences

- Editors without `content.approve` can draft with AI, but someone with `content.approve` must
  confirm the review before the post can be scheduled.
- Content created before this change has `aiAssisted = false`. There is no retroactive marking,
  because no reliable provenance exists for it.

## Open for owner override

- Whether self-review is allowed (default: yes, audited).
- Whether a human edit after review should clear the review (default: no).
- Whether AI alt text (stored with the media, not in the caption) should also count as AI copy
  (default: no).
