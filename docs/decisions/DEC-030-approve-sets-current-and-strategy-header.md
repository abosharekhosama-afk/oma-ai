# DEC-030 — Approve makes a strategy current; one header on every strategy page

Status: accepted (2026-11-22)
Supersedes: the "never set current on approve" rule (DP-003-003 B, `neverAutoSelectCurrentOnApprove`).

## Context

A live review of an approved strategy found that approval alone did nothing visible:
the brand overview still said "create a strategy", the brand journey kept steps 6–7
("plan → requests", "calendar") locked with "approve the strategy package first", and
the user had to find an English "Set current" button. The guided step strip from #244
also never appeared on live because the API deploy lagged the web deploy and the
strip silently hid when `GET …/readiness` failed.

## Decision

1. **Approve → current.** `approvePackage` sets `BrandWorkspace.currentApprovedStrategyId`
   to the approved strategy in the same transaction, writes `strategy.current_changed`
   (`via: approve`) and audits `strategy.current_set`. This only happens when the
   approver also holds `strategy.set_current` (owners/admins), so approval never widens
   what a role can do. `strategy.approved` outbox payload carries `current_auto_set`.
2. **Effective current for older data (read-only).** When no usable pointer exists,
   reads (`GET /brands/:id`, `GET …/strategies`, `GET …/strategies/:id`,
   `GET …/current-strategy`) treat the most recently approved ACTIVE strategy as current
   and flag it `current_inferred` / `current_strategy_inferred`. Nothing is written on
   read. "Clear current" therefore only clears the explicit pointer; the UI no longer
   offers it. "Set current" remains for switching between two approved strategies.
3. **One status per strategy.** `display_status` (CURRENT / APPROVED / IN_REVIEW /
   CHANGES_REQUESTED / DRAFT / ARCHIVED) replaces showing the `ACTIVE` lifecycle flag.
4. **Shared strategy header.** `StrategySubnav` renders the tabs, strategy name, status,
   track chips (a disabled track shows as "paused") and the five-step strip on every
   strategy page. If `readiness` fails, the journey is computed client-side from the
   version detail so the strip never disappears.
5. **Breadcrumbs** on strategy routes read brand / strategies / _strategy name_ / section.

## Data on live

No migration. Existing approved-but-not-current strategies are recognised by the
inference above as soon as the API is deployed. Optionally pin the pointer by opening
the strategy and pressing "تثبيت كاستراتيجية حالية" (shown only while inferred).
