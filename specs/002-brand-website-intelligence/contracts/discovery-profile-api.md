# Contract: Discovery & Profile API

**Feature**: `002-brand-website-intelligence`  
**Status**: `DRAFT FOR REVIEW` — documentation only

---

## Capabilities

| Method | Path | Capability |
| ------ | ---- | ---------- |
| `GET` | `/brands/:brandId/scans/:scanId/pages` | `brand.discovery.review` or `brand.read` (plan: **read** for list; **review** for write dispositions if any) |
| `GET` | `/brands/:brandId/scans/:scanId/products` | `brand.read` |
| `GET` | `/brands/:brandId/scans/:scanId/evidence` | `brand.read` |
| `GET` | `/brands/:brandId/evidence/:evidenceId` | `brand.read` (+ re-authz on open) |
| `GET` | `/brands/:brandId/profiles/:versionId` | `brand.read` |
| `GET` | `/brands/:brandId/profiles` | `brand.read` |
| `GET` | `/brands/:brandId/profiles/:versionId/compare` | `brand.read` |
| `PATCH` | `/brands/:brandId/profiles/:versionId` | `brand.insight.edit` |
| `POST` | `/brands/:brandId/insights/:insightId/accept` | `brand.insight.decide` |
| `POST` | `/brands/:brandId/insights/:insightId/reject` | `brand.insight.decide` |
| `POST` | `/brands/:brandId/profiles/:versionId/approve` | `brand.version.approve` |
| `POST` | `/brands/:brandId/profiles/:versionId/reject` | `brand.version.approve` |

**Rule:** Insight decide endpoints MUST NOT accept whole-version reject/approve payloads.

---

## Pagination

All list endpoints: `cursor` + `limit` (default 25, max 100). Filters allowlisted.

---

## `GET .../pages`

**Query:** `classification`, `fetch_status`, `cursor`, `limit`.

**Item shape:**

```json
{
  "id": "01…",
  "url": "https://…",
  "canonical_url": "https://…",
  "title": "…",
  "classification": "PRODUCT",
  "fetch_status": "FETCHED",
  "http_status": 200,
  "locale_hint": "en"
}
```

---

## `GET .../products`

**Query:** `kind` (`PRODUCT`|`SERVICE`), `cursor`, `limit`.

**Item:** name, description, category, sku_public, price fields as observed, availability, source_page_id, parent_product_id, evidence linkage ids.

---

## `GET .../evidence` and `GET .../evidence/:evidenceId`

**Item:**

```json
{
  "id": "01…",
  "source_url": "https://…",
  "canonical_url": "https://…",
  "page_title": "…",
  "fetched_at": "…",
  "excerpt_text": "…",
  "content_hash": "sha256:…",
  "extraction_method": "JSON_LD",
  "scan_attempt_id": "01…",
  "discovered_page_id": "01…"
}
```

No full HTML body. Opening evidence re-checks tenant/brand/capability (`FR-BWI-025`).

---

## `GET .../profiles/:versionId`

**Response includes:**

- `status`, `row_version`, `scan_attempt_id`, `ai_availability`
- `sections` (overview, catalog, languages, claims, risks, evidence refs, optional deferred)
- `insights[]` with `info_state`, `review_status`, `discovery_tier`, `evidence_id`, confidence
- `coverage_snapshot` (for Partial disclosure)
- `eligibility` preview object: `{ "approvable": bool, "blocking_reasons": [] }` (advisory; server re-validates on approve)

---

## `GET .../profiles`

History list: id, status, created_at, approved_at, scan_attempt_id, ai_availability.

---

## `GET .../profiles/:versionId/compare`

**Query:** `against=otherVersionId` (default: current approved).

**Response:** field-level diff of sections/insights with left/right values and info states. Does not mutate.

---

## `PATCH .../profiles/:versionId`

Human edits on Draft / Needs review only.

**Headers:** `If-Match` / body `row_version`.  
**Body:** patch of editable fields / insight text values.

**Behavior:** Creates `HumanEdit` rows; sets insight `USER_CORRECTED` / `USER_CONFIRMED` as appropriate; bumps `row_version`.

**Errors:** `409 CONFLICT_VERSION`, `409 CONFLICT_STATE` if Approved/Rejected/Superseded, `VALIDATION_FAILED`.

**Audit:** `brand.profile.edited`.

---

## Insight item decisions

### `POST .../insights/:insightId/accept`

**Body:** `{ "row_version": n }`  
**Effect:** `review_status=ACCEPTED`; info_state → `USER_CONFIRMED` (from AI_INFERRED or OBSERVED).  
**Capability:** `brand.insight.decide` only.  
**Audit:** `brand.insight.accepted`.

### `POST .../insights/:insightId/reject`

Same pattern → `REJECTED`; excluded from approved-claims set.  
**Audit:** `brand.insight.rejected`.

Whole-version reject is a **separate** endpoint requiring `brand.version.approve`.

---

## `POST .../profiles/:versionId/approve`

**Capability:** `brand.version.approve`  
**Headers:** `Idempotency-Key` required (e.g. `profile:approve:{versionId}`).

**Body:**

```json
{
  "row_version": 3,
  "acknowledge_incomplete": true,
  "confirm_summary": true,
  "reason": "optional note"
}
```

**Server checks (atomic):**

1. Version status MUST be `NEEDS_REVIEW` only (Draft edits promote to Needs review before approve; approve-from-`DRAFT` is **not** allowed).
2. Originating ScanAttempt not `CANCELLED`; not `FAILED` without reviewable data.
3. No unresolved edit conflicts / late-result locks on this version.
4. `REQUIRED_FOR_APPROVAL` present (FR-BWI-020a).
5. No fact-class items lacking evidence.
6. All remaining `AI_INFERRED` disposed or excluded from approved set.
7. If scan `PARTIAL`, require `acknowledge_incomplete === true` and prior disclosure payload available.
8. `confirm_summary === true`.

**On success (TX):**

- CAS status → `APPROVED`
- Write `ApprovalRecord` (unique)
- Point brand `current_approved_profile_version_id`
- Supersede previous approved
- Audit `brand.profile.approved` including incompleteness warnings JSON when Partial (`FR-BWI-029d`)

**Response `200`:** approved version summary.

**Errors:** `409 CONFLICT_VERSION`, `409 CONFLICT_STATE`, `422 APPROVAL_INELIGIBLE` with `blocking_reasons[]`, `403 PERMISSION_DENIED`.

---

## `POST .../profiles/:versionId/reject`

**Capability:** `brand.version.approve` (DP-004)  
**Body:** `{ "row_version": n, "reason": "…" }`  
**Effect:** status → `REJECTED`; no Approved pointer change.  
**Audit:** `brand.profile.rejected`.  
**Forbidden** for Insight decide capability alone → `403`.

---

## Partial approval disclosure payload (required in UI; echoed in GET profile)

```json
{
  "coverage_summary": { "pages_fetched": 12, "pages_failed": 3, "pages_skipped": 1 },
  "failed_pages": [],
  "skipped_pages": [],
  "required_missing": [],
  "unknown_fields": ["brand.description"],
  "claims_without_evidence": [],
  "ai_availability": "NOT_CONFIGURED",
  "version_id": "01…",
  "scan_attempt_id": "01…",
  "scan_status": "PARTIAL"
}
```

Approval without this disclosure path when Partial → `422 APPROVAL_INELIGIBLE`.
