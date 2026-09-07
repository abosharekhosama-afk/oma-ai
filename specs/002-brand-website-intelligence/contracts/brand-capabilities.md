# Contract: Brand Capability Codes

**Feature**: `002-brand-website-intelligence`
**Status**: `DRAFT FOR REVIEW`
**Integration:** Extend Foundation capability registry + `CapabilitiesGuard.routeRequirements` (both must stay in sync).

---

## Codes

| Code                     | Description                                                                  | Sensitive    |
| ------------------------ | ---------------------------------------------------------------------------- | ------------ |
| `brand.create`           | Create / rename Brand Workspace                                              | Yes (create) |
| `brand.read`             | List/read brands, scans, discovery, profiles, evidence                       | No           |
| `brand.archive`          | Archive brand (cancels active scans)                                         | Yes          |
| `brand.website.connect`  | Connect/replace public website + attestation                                 | Yes          |
| `brand.scan.control`     | Start / cancel / retry scans                                                 | Yes          |
| `brand.discovery.review` | Discovery review UI actions beyond read (if any write dispositions on pages) | Soft         |
| `brand.insight.edit`     | Edit profile draft fields / insights                                         | Yes          |
| `brand.insight.decide`   | Accept/reject **individual** insights only                                   | Yes          |
| `brand.version.approve`  | Approve profile version **and** whole-version Reject                         | Yes          |

---

## Separation rules (DP-004)

- Holding `brand.insight.decide` alone MUST NOT authorize:
  - `POST .../profiles/:versionId/approve`
  - `POST .../profiles/:versionId/reject`
- Holding `brand.version.approve` does not imply unrestricted insight edit unless also granted edit/decide as product profiles define.

---

## Planned profile grants (implement-time seed; interim)

| Foundation profile                     | Suggested grants                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `COMPANY_OWNER`                        | All brand.*                                                                                                  |
| Strategist / brand manager (if exists) | create, read, website.connect, scan.control, discovery.review, insight.edit, insight.decide, version.approve |
| Contributor / viewer                   | `brand.read` only                                                                                            |

Exact matrix follows Foundation seed patterns; deny-by-default for unspecified routes.

---

## Worker re-authorization

Before crawl mutate and before analysis mutate, worker must re-check:

- Membership `ACTIVE` for `actor` (or job’s acting principal policy — foundation uses mid-flight membership of relevant user)
- Required capability still present (`brand.scan.control` for ingestion; analysis may require same or a dedicated code — **plan: reuse `brand.scan.control` for analysis enqueue, `brand.insight.edit` not required for system AI proposals**)

On failure: fail closed (`PERMISSION_DENIED`), no partial silent success.

---

## Audit mapping

Sensitive capability actions map to audit event types listed in brand/scan/profile contracts.
