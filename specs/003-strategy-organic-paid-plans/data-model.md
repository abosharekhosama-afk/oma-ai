# Data Model: Strategy — Organic & Paid Plans

**Feature**: `003-strategy-organic-paid-plans`
**Date**: 2026-09-08
**Status**: `READY_FOR_REVIEW` — logical model only (**no Prisma migration in PLAN stage**)
**Spec**: [`spec.md`](./spec.md) | **Plan**: [`plan.md`](./plan.md)

Conventions inherit Foundation + Feature 002: ULID string ids, `tenantId` on tenant-scoped rows, optimistic `version`/`rowVersion`, append-only audit via Foundation `AuditEvent`, idempotency via Foundation `IdempotencyRecord`.

---

## 0. Ownership map

| Entity                                                | Logical owner                                                     | Authoritative writer                 | Readers                  | Must not                         |
| ----------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------ | ------------------------ | -------------------------------- |
| `Strategy` / versions / tracks / comments / approvals | OMA Strategy (003)                                                | Strategy commands                    | Strategy read            | Rewrite Brand Profile / evidence |
| `BrandWorkspace.currentApprovedStrategyId`            | Brand Workspace metadata (003 writes pointer; 002 owns brand row) | Strategy set-current / archive-clear | Brand + strategy readers | Auto-set on approve              |
| `ProfileVersion` / `EvidenceExcerpt`                  | Feature 002                                                       | 002 only                             | 003 read/link            | Mutate from 003                  |
| Audit / Outbox / Notification / Capability            | Foundation                                                        | Foundation + 003 append refs         | All                      | Parallel systems                 |

---

## 1. BrandWorkspace extension (002 table)

| Field                       | Notes                                                        |
| --------------------------- | ------------------------------------------------------------ |
| `currentApprovedStrategyId` | Nullable ULID; logical FK to `Strategy.id` same tenant/brand |
| `version`                   | Existing optimistic concurrency — bump on pointer change     |

**Rules:** See spec §8.4. Clear on archive of current strategy; never auto-pick replacement.

**Index:** `(tenantId, currentApprovedStrategyId)` optional; always validate brand ownership in command.

---

## 2. Strategy

| Field                                    | Notes                                                             |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `id`                                     | ULID                                                              |
| `tenantId` / `brandId`                   | Required; brand must belong to tenant                             |
| `name`                                   | Display title                                                     |
| `status`                                 | `ACTIVE` \| `ARCHIVED`                                            |
| `originStrategyId`                       | Nullable clone lineage                                            |
| `createdByUserId`                        |                                                                   |
| `version`                                | Optimistic concurrency for strategy-level metadata (name/archive) |
| `createdAt` / `updatedAt` / `archivedAt` |                                                                   |

**Indexes:** `(tenantId, brandId, updatedAt)`; `(tenantId, brandId, status)`.

**Delete:** Soft-archive only in 003.

---

## 3. StrategyVersion

| Field                                                | Notes                                                                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                 | ULID                                                                                                                                          |
| `tenantId` / `brandId` / `strategyId`                |                                                                                                                                               |
| `status`                                             | `DRAFT` \| `IN_REVIEW` \| `CHANGES_REQUESTED` \| `APPROVED` \| `REJECTED` \| `SUPERSEDED` \| `ARCHIVED`                                       |
| `rowVersion`                                         | Optimistic concurrency while editable                                                                                                         |
| `versionNumber`                                      | Monotonic per strategy (1..n)                                                                                                                 |
| `linkedApprovedProfileVersionId`                     | Nullable; **required** for `IN_REVIEW`/Approve; must be 002 `ProfileVersion` APPROVED same brand                                              |
| `draftProfileVersionId`                              | Optional drafting aid; never satisfies gate                                                                                                   |
| `organicEnabled` / `paidEnabled`                     | Booleans                                                                                                                                      |
| `organicDisabledRationale` / `paidDisabledRationale` | Required when respective enabled=false at submit                                                                                              |
| `aiAvailability`                                     | `NOT_CONFIGURED` \| `UNAVAILABLE` \| `REFUSED` (default NOT_CONFIGURED)                                                                       |
| `foundationJson`                                     | Goals, positioning, messages, constraints, market/locale, shared campaign objectives, funnel, formats, cadence, horizon — structured document |
| `unknownsAcknowledged`                               | Bool for submit/approve disclosure                                                                                                            |
| `submittedAt` / `submittedByUserId`                  |                                                                                                                                               |
| `approvedAt` / `approvedByUserId`                    | Denormalized; authoritative approval row separate                                                                                             |
| `rejectedAt` / `rejectedByUserId`                    |                                                                                                                                               |
| `supersedesVersionId`                                | Prior version when created from revise                                                                                                        |
| `createdAt` / `updatedAt`                            |                                                                                                                                               |

**Immutability:** When status ∈ {`IN_REVIEW`,`APPROVED`,`SUPERSEDED`,`REJECTED`,`CHANGES_REQUESTED`,`ARCHIVED`} content fields are frozen. Edits require `POST .../revise` (or `from-approved`) creating a new `DRAFT`. Only `DRAFT` accepts `PATCH`.
**Unique:** `(strategyId, versionNumber)`.
**Indexes:** `(tenantId, brandId, strategyId, createdAt)`; `(linkedApprovedProfileVersionId)`.

### foundationJson (logical keys)

`goals[]`, `businessObjectives[]`, `positioning`, `keyMessages[]`, `constraints[]`, `marketLocale`, `sharedCampaignObjectives[]`, `funnelStages[]`, `recommendedFormats[]`, `cadence`, `timeHorizon`, `sharedChannels[]`, `contentPillars[]` (ids or embedded), `notesInternal`.

Each material statement object inside `foundationJson` arrays/objects MUST carry `infoClass` (`USER_AUTHORED` \| `BRAND_LINKED` \| `ASSUMPTION` \| `UNKNOWN` \| `RECOMMENDATION` \| `AI_PROPOSAL`) per FR-SOP-031. Scalar fields MAY be wrapped as `{ value, infoClass }`.

---

## 4. StrategyOrganicTrack (1:1 version)

| Field                                          | Notes                      |
| ---------------------------------------------- | -------------------------- |
| `id`                                           | ULID                       |
| `tenantId` / `brandId` / `strategyVersionId`   | Unique `strategyVersionId` |
| `pillarsJson` / `channelsJson` / `formatsJson` |                            |
| `frequency` / `communityGoals` / `growthGoals` |                            |
| `messageCta`                                   | Planning label             |
| `funnelStagesJson`                             |                            |
| `kpisJson`                                     | Organic KPIs               |
| `ownerRoleLabelsJson`                          | Planning labels            |
| `dependenciesJson`                             |                            |
| `rowVersion`                                   |                            |

---

## 5. StrategyPaidTrack (1:1 version)

| Field                                                           | Notes                                    |
| --------------------------------------------------------------- | ---------------------------------------- |
| `id`                                                            | ULID                                     |
| `tenantId` / `brandId` / `strategyVersionId`                    | Unique `strategyVersionId`               |
| `campaignObjectivesJson` / `funnelStagesJson` / `audiencesJson` |                                          |
| `offerAngle` / `formatsJson` / `placementsJson`                 | Planning labels — not ad objects         |
| `budgetAmount` / `budgetCurrency`                               | **Planning only**; label in UX           |
| `allocationJson`                                                | Breakdown                                |
| `expectedKpisJson`                                              | Explicitly non-guarantee                 |
| `scheduleWindowStart` / `scheduleWindowEnd`                     | Planning window — not publisher schedule |
| `landingDestination`                                            | URL or note                              |
| `approvalNotes`                                                 |                                          |
| `rowVersion`                                                    |                                          |

**Constraint:** No external account ids, pixel ids, or provider campaign ids in 003.

---

## 6. StrategyAudience

| Field                                        | Notes                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `id`                                         | ULID                                                                                                |
| `tenantId` / `brandId` / `strategyVersionId` |                                                                                                     |
| `name` / `description`                       |                                                                                                     |
| `infoClass`                                  | `USER_AUTHORED` \| `BRAND_LINKED` \| `ASSUMPTION` \| `UNKNOWN` \| `RECOMMENDATION` \| `AI_PROPOSAL` |
| `sortOrder`                                  |                                                                                                     |

---

## 7. StrategyCompetitorReference

| Field                                        | Notes                          |
| -------------------------------------------- | ------------------------------ |
| `id`                                         | ULID                           |
| `tenantId` / `brandId` / `strategyVersionId` |                                |
| `title`                                      |                                |
| `sourceUrl` / `sourceNote`                   | Manual; no live fetch required |
| `capturedAt`                                 |                                |
| `uncertainty`                                |                                |
| `infoClass`                                  |                                |

---

## 8. StrategyKpi

| Field                                        | Notes                             |
| -------------------------------------------- | --------------------------------- |
| `id`                                         | ULID                              |
| `tenantId` / `brandId` / `strategyVersionId` |                                   |
| `name` / `targetValue` / `unit`              |                                   |
| `appliesTo`                                  | `STRATEGY` \| `ORGANIC` \| `PAID` |
| `infoClass`                                  |                                   |

---

## 9. StrategyRiskAssumptionDependency

| Field                                        | Notes                                               |
| -------------------------------------------- | --------------------------------------------------- |
| `id`                                         | ULID                                                |
| `tenantId` / `brandId` / `strategyVersionId` |                                                     |
| `kind`                                       | `RISK` \| `ASSUMPTION` \| `DEPENDENCY` \| `UNKNOWN` |
| `text`                                       |                                                     |
| `infoClass`                                  |                                                     |

---

## 10. StrategyEvidenceLink

| Field                                        | Notes                      |
| -------------------------------------------- | -------------------------- |
| `id`                                         | ULID                       |
| `tenantId` / `brandId` / `strategyVersionId` |                            |
| `evidenceExcerptId`                          | Nullable FK logical to 002 |
| `profileFieldKey`                            | Nullable                   |
| `label`                                      |                            |
| `createdByUserId` / `createdAt`              |                            |

**Open path:** API re-checks tenant/brand + `brand.read` (or strategy.read) before returning excerpt body.

---

## 11. StrategyComment

| Field                                        | Notes               |
| -------------------------------------------- | ------------------- |
| `id`                                         | ULID                |
| `tenantId` / `brandId` / `strategyVersionId` |                     |
| `actorUserId`                                |                     |
| `body`                                       |                     |
| `anchorPath`                                 | Optional field path |
| `createdAt`                                  |                     |

---

## 12. StrategyReviewDecision

| Field                                        | Notes                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `id`                                         | ULID                                                                                     |
| `tenantId` / `brandId` / `strategyVersionId` |                                                                                          |
| `actorUserId`                                |                                                                                          |
| `action`                                     | `SUBMIT` \| `COMMENT` \| `REQUEST_CHANGES` \| `APPROVE_PACKAGE` \| `REJECT` \| `ARCHIVE` |
| `comment`                                    |                                                                                          |
| `capabilityCode`                             |                                                                                          |
| `correlationId`                              |                                                                                          |
| `createdAt`                                  |                                                                                          |

---

## 13. StrategyApprovalRecord

| Field                            | Notes                    |
| -------------------------------- | ------------------------ |
| `id`                             | ULID                     |
| `tenantId` / `brandId`           |                          |
| `strategyVersionId`              | **Unique**               |
| `actorUserId`                    | Human only               |
| `capabilityCode`                 | Must be strategy.approve |
| `linkedApprovedProfileVersionId` | Snapshot at approve      |
| `organicEnabled` / `paidEnabled` | Snapshot                 |
| `comment`                        |                          |
| `unknownsAcknowledged`           |                          |
| `createdAt`                      |                          |

---

## 14. StrategyHumanEdit (optional audit aid)

Append-only field-level edits for Draft (before/after refs). Complements Foundation `AuditEvent`.

---

## 15. State machines

### 15.1 Strategy (container)

`ACTIVE` → `ARCHIVED`
Restore only if future policy adds it (out of 003 default).

Side effect: if `BrandWorkspace.currentApprovedStrategyId == this.id` on archive → set null + audit.

### 15.2 StrategyVersion

| From                                          | To                  | Actor capability                      | Guards                                                                                          |
| --------------------------------------------- | ------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| (create)                                      | `DRAFT`             | strategy.create/edit                  | Brand accessible                                                                                |
| `DRAFT`                                       | `IN_REVIEW`         | strategy.submit                       | ≥1 track enabled; disabled rationales; required fields; **Approved profile linked**; rowVersion |
| `IN_REVIEW`                                   | `APPROVED`          | strategy.approve                      | Package eligibility; profile still valid; **not AI**                                            |
| `IN_REVIEW`                                   | `REJECTED`          | strategy.approve                      |                                                                                                 |
| `IN_REVIEW`                                   | `CHANGES_REQUESTED` | strategy.approve                      |                                                                                                 |
| `CHANGES_REQUESTED` / `REJECTED` / `APPROVED` | new `DRAFT`         | strategy.edit                         | Via `revise` or `from-approved`; copy package; new versionNumber; no approval inheritance       |
| `APPROVED`                                    | `SUPERSEDED`        | system on newer approve same strategy |                                                                                                 |
| `*`                                           | `ARCHIVED`          | strategy.archive                      | Policy                                                                                          |

### 15.3 Track enablement

Booleans on version; toggling only in `DRAFT` (or editable revision). Submit requires rationale if disabled.

### 15.4 Current pointer

Not a version status. Commands: `set_current(strategyId)`, `clear_current`.
Eligibility: strategy same brand/tenant; has non-superseded `APPROVED` version; actor has `strategy.set_current`.

---

## 16. Concurrency & idempotency

| Command                                     | Concurrency token            | Idempotency key scope                 |
| ------------------------------------------- | ---------------------------- | ------------------------------------- |
| Patch draft version                         | `StrategyVersion.rowVersion` | optional                              |
| Submit / approve / reject / request-changes | version id + rowVersion      | `tenantId+actor+action+versionId+key` |
| Set/clear current                           | `BrandWorkspace.version`     | `tenantId+brandId+action+key`         |
| Archive strategy                            | `Strategy.version`           | yes                                   |

---

## 17. Transaction / outbox boundaries

Single transaction examples:

1. **Submit:** validate → freeze version `IN_REVIEW` → review decision row → audit → outbox `strategy.submitted`.
2. **Approve package:** validate → `APPROVED` + supersede prior → approval record → audit → outbox `strategy.approved`.
3. **Set current:** validate → bump brand version → set pointer → audit → outbox `strategy.current_changed`.
4. **Archive current strategy:** archive strategy → clear pointer if match → audit → outbox.

---

## 18. Integrity rules (DB + app)

- Every row: `tenantId` matches parent brand’s tenant.
- `linkedApprovedProfileVersionId` must match brand + APPROVED.
- Cross-tenant profile/strategy ids rejected.
- Paid track never stores live spend provider ids.
- Approved version rows: application forbids UPDATE of content columns (enforce in service; optional DB trigger later).
