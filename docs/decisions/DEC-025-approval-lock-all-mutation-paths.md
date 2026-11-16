# DEC-025: Approval lock on every mutation path, with explicit audited unlock

- Status: Accepted (Phase 2 · Planable W2). Every default here can be overridden.
- Date: 2026-11-16
- Builds on: DEC-022 (approval settings), DEC-023 (Planned vs Scheduled), DEC-024 (AI review gate)

## Context

Before this change, `lockAfterApproval` was enforced only in `PATCH /content/:id`.
Approved posts could still change through other endpoints: publish targets,
detach and ungroup, and preferred audience. With the lock off, an approved post
could be edited and keep its `APPROVED` state. Either way, the post that went
out could differ from the one an approver saw.

## Decision

1. **Approval binds what gets published.** These fields are lockable: `title`,
   `caption` (including applying new AI output), `media`, `channel`,
   `publish_targets`, `preferred_audience` and `sync_group` (detach and ungroup).
   One server gate, `enforceContentMutation` (`apps/api/src/content/content-lock.ts`,
   pure rules in `@oma/domain` `decideContentMutation`), runs on every path that
   changes them:
   - `PATCH /content/:id`
   - `POST /content/:id/publish-target`
   - `POST /content/:id/preferred-audience`
   - `POST /content/:id/detach`
   - `POST /content/:id/ungroup`
2. **Lock on** (`lockAfterApproval = true`) and `APPROVED`: any real change to a
   lockable field returns **409 `CONTENT_LOCKED` / `error.content_locked`**, with
   `details[0].fields`. A no-op save, such as re-saving an unchanged form or
   reordering the same channels, is not a change.
3. **Lock off** and `APPROVED` under `OPTIONAL` or `REQUIRED`: the edit goes through
   and the approval **resets** to `NOT_REQUESTED`. The approval event is
   `APPROVAL_RESET` and the audit event is `content.approval_reset_on_edit`. The
   response carries `approval_reset { from, fields, unscheduled }`. Under
   `REQUIRED`, a scheduled post is also taken off the schedule and stays
   **Planned** (DEC-023), so it never sits in the queue only to be skipped. Under
   `NONE`, nothing resets.
4. **During review:** if a `PARTIALLY_APPROVED` post changes, its collected
   approvals restart at 0 (state `PENDING`), so every approver sees the final
   version.
5. **Planning metadata is never locked:** planned date, labels, client
   visibility, campaign, track and comments. Moving the planned date of an
   approved post stays allowed, per DEC-022.
6. **There are only two unlock paths, and both are audited** (`content.unlocked`,
   `afterRef via:…`):
   - `POST /content/:id/reopen` takes `{ reason }`. The reason is required and
     must be 1–1000 characters; otherwise the API returns 400
     `error.reopen_reason_required`. Only `APPROVED` content can be reopened;
     otherwise the API returns 409 `error.reopen_not_approved`. Reopen moves the
     approval to `NOT_REQUESTED` and status to `DRAFT`, writes the event
     `REOPEN` with the reason, and takes a scheduled post off the schedule while
     keeping it Planned.
   - `POST /content/:id/request-changes` is now also allowed from `APPROVED`,
     with the same unschedule rule. The state becomes `CHANGES_REQUESTED`.
     Both require `content.approve`, so only people who can approve can unlock.

## Defaults (override-able)

- `lockAfterApproval` stays **off by default** (Planable's lock is opt-in).
  Integrity still holds through rule 3, the reset on edit.
- Unlocking requires `content.approve`. Alternative: allow `content.update` with
  the reason logged.
- A reset on edit under `OPTIONAL` does not unschedule, because approval is
  advisory there.

## Consequences

- Clients must handle `approval_reset` in responses and show it (Phase 2 · web PR).
- Integration coverage: `tests/integration/content-approval-lock.integration.test.ts`
  hits every lockable path.
