# DEC-023: Schedule readiness, connected accounts, Planned vs Scheduled

**Status:** `ACCEPTED_DEFAULT / OPEN_FOR_OWNER_OVERRIDE`
**Date:** 2026-11-16
**Pillar:** 3 (Planable W2: approvals, lock and scheduling)

## Context

- `schedule()` checked approval only. A post could be SCHEDULED with no publishing account, or
  with an account that later disconnected.
- The worker only looked at posts that had publish targets, so those posts waited silently.
- Schedule-on-approval swallowed every error.
- `plannedAt` and `scheduledAt` already existed, but there was no single definition of what
  "planned" and "scheduled" mean, and unscheduling dropped the post off the calendar.

## Decision

1. **Planned is not Scheduled.**
   - `plannedAt` is calendar intent. Changing it never changes `scheduleState` or `scheduledAt`.
   - Scheduling is a commitment to publish at `scheduledAt`.
   - Unscheduling keeps the date as `plannedAt`, so the post stays on the calendar as Planned.
   - `calendar.state` is one of `UNPLANNED | PLANNED | SCHEDULED | CANNOT_SCHEDULE | PUBLISHED`.
     It is returned on every content read, and lists accept `?calendar_state=planned|scheduled|unplanned`.
2. **One readiness function.** `evaluateScheduleReadiness` (`@oma/domain`) returns every blocker:
   - `ARCHIVED`, `REJECTED`, `APPROVAL_REQUIRED` (from the approval policy).
   - `NO_CONNECTED_ACCOUNT`: no publish target with status `CONNECTED`.
   - `ACCOUNT_NOT_CONNECTED`: one entry per target that needs reauth, has errored, or was disconnected.
   - `CHANNEL_NOT_CONNECTED`: the post's channel is a feed network (facebook, instagram, linkedin,
     tiktok, x) and no connected target is on that network.
3. **Where the check runs.**
   - `schedule`, `enqueue` and `publish-now` return `409 SCHEDULE_BLOCKED` with
     `details[0].blockers`.
   - `GET /content/:id/schedule-readiness` returns the checklist for the UI.
   - Schedule-on-approval keeps the post APPROVED and returns
     `auto_schedule: { attempted, scheduled: false, blockers }`. It also stores
     `lastPublishSkipReason` and writes the audit event `content.schedule_on_approval_blocked`.
4. **After scheduling.**
   - Blockers are re-evaluated live on every read. A scheduled post with a blocker shows
     `calendar.state = CANNOT_SCHEDULE` and `workflow.publishDisplay = CANNOT_SCHEDULE`, plus the
     blockers.
   - The worker skips such a post with a visible `lastPublishSkipReason`, both for a post with no
     account at all and for a post whose account is not connected. It does not claim the targets
     or fail them, so the post publishes on the next tick once the account is reconnected.
   - `CHANNEL_NOT_CONNECTED` is checked before scheduling only. After that, the publish targets
     decide where the post goes.
5. **Flag.** `SCHEDULE_REQUIRES_CONNECTED_ACCOUNT` is on by default; set it to `false` for demo
   environments. Approval blockers always apply. A post with no target is never publishable,
   whatever the flag says.

## Consequences

- E2E flows that schedule without any connected account need a seeded social page, or must set
  the flag to `false`.
- `status = SCHEDULED` stays as a legacy column; `scheduleState` plus `calendar.state` are the
  source of truth.

## Open for owner override

- Whether one non-connected target should block the whole post. The default is yes: remove the
  target or reconnect it.
- Whether a scheduled time in the past is allowed (unchanged here: still allowed, and it publishes
  on the next tick).
