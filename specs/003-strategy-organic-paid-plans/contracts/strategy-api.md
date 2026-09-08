# Contract: Strategy API

**Feature**: `003-strategy-organic-paid-plans`
**Status**: `READY_FOR_REVIEW`
**Base path**: `/api/v1/brands/:brandId/strategies`
**Auth**: Foundation session; active tenant; server resolves tenant (client brandId must belong to active tenant)

All mutating commands accept optional `Idempotency-Key` header. Optimistic concurrency via `rowVersion` / `brandVersion` in body where noted. Errors: `PERMISSION_DENIED`, `CONFLICT`, `VALIDATION_FAILED`, `NOT_FOUND` (no cross-tenant existence leak).

---

## List / create

| Method | Path | Capability        | Notes                                                            |
| ------ | ---- | ----------------- | ---------------------------------------------------------------- |
| `GET`  | `/`  | `strategy.read`   | List strategies + flags (`hasApprovedVersion`, `isCurrent`)      |
| `POST` | `/`  | `strategy.create` | Create Strategy + initial `DRAFT` version; profile link optional |

---

## Strategy resource

| Method  | Path                   | Capability         | Notes                                                   |
| ------- | ---------------------- | ------------------ | ------------------------------------------------------- |
| `GET`   | `/:strategyId`         | `strategy.read`    | Overview + current version summary + profile link state |
| `PATCH` | `/:strategyId`         | `strategy.edit`    | Name etc.; requires `version`                           |
| `POST`  | `/:strategyId/archive` | `strategy.archive` | Clears Brand current if pointing here                   |

---

## Versions

| Method  | Path                                            | Capability         | Notes                                                                                                           |
| ------- | ----------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/:strategyId/versions`                         | `strategy.read`    | History                                                                                                         |
| `GET`   | `/:strategyId/versions/:versionId`              | `strategy.read`    | Full package (foundation + tracks + children)                                                                   |
| `PATCH` | `/:strategyId/versions/:versionId`              | `strategy.edit`    | `DRAFT` only; frozen otherwise — use revise; requires `rowVersion`                                              |
| `POST`  | `/:strategyId/versions/:versionId/link-profile` | `strategy.edit`    | Body `{ profileVersionId, role: "approved" \| "draft_aid" }`. `approved` satisfies gate; `draft_aid` never does |
| `POST`  | `/:strategyId/versions/from-approved`           | `strategy.edit`    | Create new Draft from an `APPROVED` snapshot                                                                    |
| `POST`  | `/:strategyId/versions/:versionId/revise`       | `strategy.edit`    | From `CHANGES_REQUESTED`, `REJECTED`, or `APPROVED`: new `DRAFT`, next versionNumber, no approval inheritance   |
| `POST`  | `/:strategyId/versions/:versionId/clone`        | `strategy.edit`    | Optional clone to **new Strategy** + Draft via `originStrategyId`; never inherits approval or Brand current     |
| `GET`   | `/:strategyId/versions/compare`                 | `strategy.compare` | Query `leftId&rightId`                                                                                          |

---

## Tracks

| Method  | Path                                                 | Capability              | Notes                                         |
| ------- | ---------------------------------------------------- | ----------------------- | --------------------------------------------- |
| `PATCH` | `/:strategyId/versions/:versionId/organic`           | `strategy.organic.edit` | Draft; enable/disable + fields                |
| `PATCH` | `/:strategyId/versions/:versionId/paid`              | `strategy.paid.edit`    | Draft; planning-only budget fields            |
| `POST`  | `/:strategyId/versions/:versionId/tracks/enablement` | `strategy.edit`         | `{ organicEnabled, paidEnabled, rationales }` |

---

## Evidence / structured children

| Method                  | Path                 | Capability                      | Notes                                   |
| ----------------------- | -------------------- | ------------------------------- | --------------------------------------- |
| `GET/POST/DELETE`       | `.../evidence-links` | read / `strategy.evidence.link` | Re-auth on evidence open                |
| `GET/POST/PATCH/DELETE` | `.../audiences`      | read / edit                     |                                         |
| `GET/POST/PATCH/DELETE` | `.../competitors`    | read / edit                     | Manual provenance only                  |
| `GET/POST/PATCH/DELETE` | `.../kpis`           | read / edit                     |                                         |
| `GET/POST/PATCH/DELETE` | `.../gaps`           | read / edit                     | risks/assumptions/dependencies/unknowns |

---

## Brand current pointer

| Method | Path                                       | Capability             | Notes                                  |
| ------ | ------------------------------------------ | ---------------------- | -------------------------------------- |
| `POST` | `/api/v1/brands/:brandId/current-strategy` | `strategy.set_current` | `{ strategyId \| null, brandVersion }` |
| `GET`  | `/api/v1/brands/:brandId/current-strategy` | `strategy.read`        | Resolves or `null` / unavailable       |

---

## Honesty / AI

| Method | Path                                 | Capability      | Notes                                                                                          |
| ------ | ------------------------------------ | --------------- | ---------------------------------------------------------------------------------------------- |
| `POST` | `.../versions/:versionId/ai/propose` | `strategy.edit` | **Must refuse** under DEC-016 with stable `AI_NOT_CONFIGURED` / `AI_REFUSED` — no fake content |

---

## UX routes (App Router)

| Route                                       | Purpose                                     |
| ------------------------------------------- | ------------------------------------------- |
| `/[locale]/app/brands/[brandId]/strategies` | List + empty/current badge                  |
| `.../strategies/new`                        | Create                                      |
| `.../strategies/[strategyId]`               | Overview + missing-profile warning          |
| `.../edit`                                  | Foundation canvas                           |
| `.../organic`                               | Organic editor                              |
| `.../paid`                                  | Paid planning editor (planning-only banner) |
| `.../evidence`                              | Evidence links panel                        |
| `.../review`                                | Submit/comments/approve                     |
| `.../versions`                              | History                                     |
| `.../versions/compare`                      | Compare                                     |

**UX states:** loading, empty, error, permission-denied, conflict (stale version), missing Approved profile, AI unavailable, Paid not live spend, current unavailable.

**i18n/a11y:** EN/AR, LTR/RTL, keyboard to primary actions, focus management on dialogs, `prefers-reduced-motion`, screen-reader labels for status badges.
