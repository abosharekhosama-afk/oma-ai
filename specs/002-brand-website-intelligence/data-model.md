# Data Model: Brand Website Intelligence

**Feature**: `002-brand-website-intelligence`
**Date**: 2026-08-26
**Status**: `DRAFT FOR REVIEW` — logical model only (**no Prisma schema / migration in PLAN_ONLY**)
**Spec**: [`spec.md`](./spec.md) | **Plan**: [`plan.md`](./plan.md)

Conventions inherit Foundation (`001` data-model): ULID string ids, `tenant_id` on tenant-scoped rows, camelCase in Prisma later, snake_case in API JSON, append-only audit, optimistic `version` / `row_version` on mutable aggregates.

---

## 1. Entity catalog

### BrandWorkspace

| Field | Notes |
| ----- | ----- |
| `id` | ULID |
| `tenant_id` | Required; FK logical to Foundation Tenant |
| `name` | Display name |
| `status` | `DRAFT` \| `READY_TO_SCAN` \| `ACTIVE` \| `ARCHIVED` |
| `current_approved_profile_version_id` | Nullable pointer |
| `primary_website_source_id` | Nullable |
| `version` | Optimistic concurrency |
| `created_at` / `updated_at` / `archived_at` | |

**Constraints:** unique optional later on `(tenant_id, name)` if product requires; index `(tenant_id, status, updated_at)`.

**SoT:** OMA Brand Intelligence.

---

### WebsiteSource

| Field | Notes |
| ----- | ----- |
| `id` | ULID |
| `tenant_id` / `brand_id` | Required |
| `normalized_url` | HTTPS public URL |
| `host` | For policy checks |
| `attestation_accepted_at` | User confirmed authorization |
| `attested_by_user_id` | |
| `validation_status` | `VALID` \| `REJECTED` |
| `validation_reason` | Safe message |
| `source_revision` | Increments on replace URL |
| `created_at` / `replaced_at` | |

**002 rule:** No commerce connector fields as SoT. Optional `notes` only.

---

### ScanAttempt

| Field | Notes |
| ----- | ----- |
| `id` | ULID |
| `tenant_id` / `brand_id` / `website_source_id` | |
| `status` | See state machine |
| `trigger` | `START` \| `RETRY` \| `RESCAN` |
| `parent_attempt_id` | Nullable for retry lineage |
| `job_run_id` | **Required** correlation to Foundation `JobRun` |
| `idempotency_key` | Unique |
| `actor_user_id` | Starter |
| `correlation_id` | |
| `progress_percent` | 0–100 advisory |
| `pages_fetched` / `pages_failed` / `pages_skipped` | Counters |
| `coverage_json` | Summary blob for Partial UI |
| `ai_availability` | `NOT_CONFIGURED` \| `UNAVAILABLE` \| `USED` \| `SKIPPED` |
| `error_code` / `error_detail` | Sanitized |
| `started_at` / `finished_at` | |
| `cancel_requested_at` | |

**Indexes:** `(tenant_id, brand_id, created_at)`; unique `idempotency_key`; unique `job_run_id`.

---

### DiscoveredPage

| Field | Notes |
| ----- | ----- |
| `id` | |
| `tenant_id` / `brand_id` / `scan_attempt_id` | |
| `url` / `canonical_url` | |
| `canonical_hash` | Hash of canonical for dedupe within attempt |
| `title` | |
| `http_status` | |
| `content_type` | |
| `classification` | `HOME` \| `PRODUCT` \| `SERVICE` \| `ABOUT` \| `FAQ` \| `CONTACT` \| `LEGAL` \| `OTHER` \| `UNKNOWN` |
| `fetch_status` | `FETCHED` \| `FAILED` \| `SKIPPED_ROBOTS` \| `SKIPPED_LIMIT` |
| `failure_reason` | |
| `locale_hint` | |
| `discovered_at` | |

**Unique:** `(scan_attempt_id, canonical_hash)` where fetched/skipped.

---

### DiscoveredProductService

| Field | Notes |
| ----- | ----- |
| `id` | |
| `tenant_id` / `brand_id` / `scan_attempt_id` | |
| `kind` | `PRODUCT` \| `SERVICE` |
| `name` / `description` | As observed |
| `category` | |
| `sku_public` | Nullable |
| `price_amount` / `price_currency` / `availability` | Observed-at-scan; nullable |
| `source_page_id` | |
| `parent_product_id` | Nullable variant parent |
| `dedupe_key` | Within attempt |
| `tier` | `REQUIRED_FOR_APPROVAL` contribution flags via presence |

---

### ExtractedObservation

| Field | Notes |
| ----- | ----- |
| `id` | |
| `tenant_id` / `brand_id` / `scan_attempt_id` | |
| `field_key` | Stable key e.g. `brand.name` |
| `discovery_tier` | `REQUIRED_FOR_APPROVAL` \| `DISCOVER_WHEN_AVAILABLE` \| `DEFERRED_ADVANCED` |
| `value_json` | Structured value or null |
| `is_unknown` | True when absent |
| `info_state` | `OBSERVED` \| `AI_INFERRED` \| `USER_CONFIRMED` \| `USER_CORRECTED` \| `STALE` |
| `confidence` | 0–1 nullable |
| `evidence_id` | Nullable FK |
| `profile_version_id` | When attached to a draft |
| `immutable` | Observations from crawl are immutable; corrections create new rows / HumanEdit |

---

### EvidenceExcerpt

| Field | Notes |
| ----- | ----- |
| `id` | |
| `tenant_id` / `brand_id` / `scan_attempt_id` | |
| `source_url` / `canonical_url` | |
| `page_title` | |
| `fetched_at` | |
| `excerpt_text` | **Short** bounded length |
| `content_hash` | Hash of normalized excerpt or fetched body fingerprint |
| `extraction_method` | `HTML_META` \| `JSON_LD` \| `OG` \| `HEURISTIC` \| `USER` \| `AI` |
| `discovered_page_id` | Nullable |

**DEC-003 gate:** No `blob_storage_ref` required. If added later, nullable + gated.

---

### ProfileVersion

| Field | Notes |
| ----- | ----- |
| `id` | |
| `tenant_id` / `brand_id` | |
| `scan_attempt_id` | Originating attempt (nullable for pure manual?) — **002:** always tied to an attempt that produced reviewable data |
| `status` | `DRAFT` \| `NEEDS_REVIEW` \| `APPROVED` \| `SUPERSEDED` \| `REJECTED` |
| `row_version` | Optimistic concurrency |
| `ai_availability` | Copied/snapshot at draft creation |
| `coverage_snapshot_json` | For Partial disclosure |
| `approved_at` / `approved_by_user_id` | |
| `rejected_at` / `rejected_by_user_id` | |
| `incompleteness_acknowledged` | Bool at approve time |
| `created_at` | |

**Immutability:** When `APPROVED`, application layer rejects updates to content tables for that version; only status→`SUPERSEDED` via newer approval.

---

### ProfileSection

Logical sections within a version (overview, catalog, languages, claims, risks, evidence index, optional deferred sections). May be JSON document on `ProfileVersion` **or** child rows — implement choice: prefer **JSON document + normalized insights** for v1 to reduce joins; document both acceptable if SoT remains version id.

---

### InsightClaim

| Field | Notes |
| ----- | ----- |
| `id` | |
| `tenant_id` / `brand_id` / `profile_version_id` | |
| `field_key` | |
| `info_state` | Foundation taxonomy |
| `review_status` | `PENDING` \| `ACCEPTED` \| `REJECTED` \| `EDITED` |
| `text_value` / `value_json` | |
| `evidence_id` | Required for fact-class approval membership |
| `discovery_tier` | |
| `created_by` | `SYSTEM` \| `AI` \| `USER` |
| `row_version` | |

---

### HumanEdit / ReviewDecision

| Field | Notes |
| ----- | ----- |
| `id` | |
| `tenant_id` / `brand_id` | |
| `profile_version_id` / `insight_id` | |
| `actor_user_id` | |
| `action` | `EDIT` \| `ACCEPT` \| `REJECT_INSIGHT` \| `REJECT_VERSION` \| `APPROVE_VERSION` |
| `before_ref` / `after_ref` | |
| `acknowledge_incomplete` | For approve Partial |
| `created_at` | |
| `correlation_id` | |

Also mirrored to Foundation `AuditEvent`.

---

### ApprovalRecord

Materialized summary of successful approve:

- `profile_version_id`, `actor_user_id`, `acknowledged_incomplete`, `warnings_json`, `coverage_snapshot_json`, `created_at`

Unique on `profile_version_id` for successful approval.

---

## 2. State machines

### BrandWorkspace

`DRAFT` → `READY_TO_SCAN` (source VALID) → `ACTIVE` (first scan accepted) → `ARCHIVED` (cancel active scans first).

| Transition | Actor | TX | Side effects | Audit |
| ---------- | ----- | -- | ------------ | ----- |
| → `READY_TO_SCAN` | Connect website | Update brand + WebsiteSource | None async | `brand.website.connected` |
| → `ACTIVE` | First successful scan accept / first scan with reviewable data | Update brand status | Optional notification | `brand.activated` |
| → `ARCHIVED` | Archive command | Cancel non-terminal attempts + archive | Cancel signals to jobs | `brand.archived` |

### ScanAttempt

`QUEUED` → `CRAWLING` → `EXTRACTING` → (`ANALYZING` **or skip**) → `SUCCEEDED` | `PARTIAL` | `FAILED` | `CANCELLED`.

- **AI absent / refusing:** after `EXTRACTING`, **skip** analysis JobRun; if observations usable → `PARTIAL`; if insufficient → `FAILED`. Do not require a no-op `ANALYZING` hop for product truth (UI may still show “analysis skipped”).
- AI unavailable + usable data ⇒ `PARTIAL`.
- AI unavailable + insufficient data ⇒ `FAILED`.
- Cancel ⇒ `CANCELLED` (no approve).
- Retry/Rescan ⇒ **new** row.
- **Concurrency:** at most **one non-terminal** `ScanAttempt` per brand.

| Transition | Actor | TX / effect | Audit |
| ---------- | ----- | ----------- | ----- |
| Create `QUEUED` | API start/retry | ScanAttempt + JobRun + Outbox | `brand.scan.started` / `retried` |
| → `CRAWLING` | Worker after reauthz | Status + JobRun RUNNING | progress logs |
| → `EXTRACTING` | Worker | Persist pages/observations/evidence | — |
| → `ANALYZING` | Worker | Enqueue analysis JobRun or skip | — |
| → `SUCCEEDED` | Worker | Draft profile; JobRun SUCCEEDED | `brand.scan.succeeded` |
| → `PARTIAL` | Worker | Draft + coverage snapshot; AI skip OK | `brand.scan.partial` |
| → `FAILED` | Worker/API | Sanitized error; JobRun failed/DEAD | `brand.scan.failed` |
| → `CANCELLED` | Cancel + worker honor | Stop fetch; JobRun cancelled | `brand.scan.cancelled` |
| Mid-flight authz lose | Worker | → `FAILED` `PERMISSION_DENIED` | `brand.scan.permission_denied_midflight` |
| Late after Approved | Worker | **No** mutate Approved; optional new Draft | `brand.scan.late_result_ignored` / `late_draft_created` |

### ProfileVersion

`DRAFT` → `NEEDS_REVIEW` → `APPROVED` | `REJECTED`.
`APPROVED` → `SUPERSEDED` when a newer version is approved.

Reject version: **Version approve** capability only.

| Transition | Capability | TX | Side effects | Audit |
| ---------- | ---------- | -- | ------------ | ----- |
| → `NEEDS_REVIEW` | System/user | Status | Notify reviewers optional | `brand.profile.needs_review` |
| Human edit while Draft/Needs review | `brand.insight.edit` | Optimistic `row_version` | HumanEdit rows | `brand.profile.edited` |
| → `APPROVED` | `brand.version.approve` | CAS + ApprovalRecord + brand pointer + supersede prior | Freeze content | `brand.profile.approved` (+ incompleteness ack) |
| → `REJECTED` | `brand.version.approve` | CAS | None on Approved pointer | `brand.profile.rejected` |
| Approved → `SUPERSEDED` | Newer approve TX | Status only | Pointer moves | included in new approve audit |

### InsightReview

`PENDING` → `ACCEPTED` | `REJECTED` | `EDITED` via Insight decide/edit.

| Transition | Capability | Notes | Audit |
| ---------- | ---------- | ----- | ----- |
| Accept | `brand.insight.decide` | Item only; info_state → USER_CONFIRMED | `brand.insight.accepted` |
| Reject | `brand.insight.decide` | Item only; out of approved-claims set | `brand.insight.rejected` |
| Edit | `brand.insight.edit` | USER_CORRECTED; bumps versions | `brand.insight.edited` |

---


## 3. Concurrency, idempotency, late results

| Concern | Mechanism |
| ------- | --------- |
| Wrong JobRun update | Payload `job_run_id` + DB load by id; tenant match |
| Duplicate scan start | Unique `ScanAttempt.idempotency_key` + JobRun.idempotencyKey |
| Concurrent profile edits | `ProfileVersion.row_version` / Insight `row_version`; 409 on stale |
| Approve race | Unique ApprovalRecord; status CAS `NEEDS_REVIEW`→`APPROVED` |
| Late worker after approve | Worker checks profile status; if Approved, write new Draft only / drop AI mutate |
| Cross-tenant | `tenantWhere` on every query |

---

## 4. Archive / delete / retention

- Archive brand: set `ARCHIVED`; cancel active attempts; hide from default lists.
- Hard delete: gated by `DEC-012`; until then soft-archive + retain evidence for audit references.
- Do not orphan audit targets: keep ids, tombstone if needed.

---

## 5. Discovery tier mapping (examples)

| Tier | Examples |
| ---- | -------- |
| `REQUIRED_FOR_APPROVAL` | Brand name (observed or user-confirmed); primary source URL; ≥1 evidence-backed identity or catalog observation; coverage summary |
| `DISCOVER_WHEN_AVAILABLE` | Description, categories, products/services fields, prices-as-seen, languages, contact/social, sitemap/canonical, JSON-LD/OG, About/FAQ/Contact/legal links, quality indicators |
| `DEFERRED_ADVANCED` | Audiences, value props, messaging pillars, tone lexicon, rich visual-cue catalogs |

---

## 6. Relationship sketch

```text
Tenant 1---* BrandWorkspace 1---* WebsiteSource
BrandWorkspace 1---* ScanAttempt 1---1 JobRun
ScanAttempt 1---* DiscoveredPage
ScanAttempt 1---* DiscoveredProductService
ScanAttempt 1---* EvidenceExcerpt
ScanAttempt 1---* ExtractedObservation
ScanAttempt 1---* ProfileVersion 1---* InsightClaim
ProfileVersion 1---0..1 ApprovalRecord
BrandWorkspace *---0..1 current Approved ProfileVersion
```
