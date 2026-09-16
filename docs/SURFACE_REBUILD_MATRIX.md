# Surface Rebuild Matrix — Visual Quality Program

**Status:** `SUPERSEDED` as the implementation sequence by Planable stages P1–P7 in `docs/PLANABLE_TO_OMA_SURFACE_MAP.md` (`DEC-017`).
**Authority:** DEC-017. DEC-013 Linear/Frame rows below are historical.

Severity: **B** = blocker for visual acceptance · **M** = major · **m** = minor
Status: all rows below are **REBUILD** or **PARTIAL** unless noted.

---

## Stage map

| Stage | Name                                   | Exit gate                         |
| ----- | -------------------------------------- | --------------------------------- |
| 1     | Golden Design System + App Shell       | V-SHELL-* + tokens                |
| 2     | Command Center + Brand + Strategy      | V-HOME-* V-BWI-* V-STR-*          |
| 3     | Campaigns + Content Planning           | V-CMP-* V-CNT-*                   |
| 4     | Requests + Tasks + Production          | V-REQ-* V-TSK-*                   |
| 5     | Deliverables + Reviews                 | V-DEL-* V-REV-*                   |
| 6     | Schedule + Analytics + Team + Settings | V-SCH-* V-ANL-* V-ORG-*           |
| 7     | Full visual certification              | All V-* + Owner visual acceptance |

---

## Master matrix (surface × gaps)

| OMA surface                | Route                       | OMA evidence                   | Canonical ref + surface            | Structural gap                    | Visual gap            | Interaction gap                 | Workflow gap                        | Responsive/a11y gap       | Sev | Required rebuild | Acceptance evidence            |
| -------------------------- | --------------------------- | ------------------------------ | ---------------------------------- | --------------------------------- | --------------------- | ------------------------------- | ----------------------------------- | ------------------------- | --- | ---------------- | ------------------------------ |
| App shell                  | `*`                         | `command-center.json` rail 220 | Linear sidebar+top                 | Flat 14 links; no collapse        | No elev; 16px density | No Cmd-K; weak switcher density | —                                   | Mobile stacks entire rail | B   | Stage 1 shell    | V-SHELL-01…                    |
| Top bar                    | shell                       | top ~66px                      | Linear header                      | Missing search/create             | Flat white bar        | No keyboard search              | —                                   | OK width                  | B   | Stage 1          | V-SHELL-02                     |
| Command Center             | `/app`                      | shot `command-center-1440`     | Linear home density + OMA          | Mixed demo+real without hierarchy | Card grid generic     | Next-actions weak               | Journey unclear visually            | 390 measured              | B   | Stage 2          | V-HOME-01                      |
| Brand Intelligence         | `/app/brands…`              | brands-1440                    | Semrush tables + Linear            | Table OK-ish                      | Shell still weak      | —                               | —                                   | RTL OK prior              | M   | Stage 2 chrome   | V-BWI-01                       |
| Strategy                   | `/app/brands/…/strategies…` | (002/003)                      | Jasper sections + Linear           | Nested OK                         | Not densified         | —                               | Organic/Paid already correct domain | —                         | M   | Stage 2          | V-STR-01                       |
| Campaigns                  | `/app/campaigns`            | campaigns-1440                 | Planable campaigns                 | Dense table + filters             | Stage 3 rebuild       | Filters/create dialog           | Organic/Paid + strategy links       | Mobile cards              | B   | Stage 3          | V-CMP-01 / V-CAM-01            |
| Campaign detail            | `/app/campaigns/[id]`       | —                              | Planable campaign context          | Workspace tabs                    | Stage 3 rebuild       | Edit drawer honesty             | Strategy→content links              | —                         | M   | Stage 3          | V-CMP-02 / V-CAM-02            |
| Content calendar/grid/list | `/app/content`              | content-1440                   | Planable Calendar/Feed/Grid/List   | Month calendar + drawer           | Stage 3 rebuild       | Filters + composer              | Publishing/AI honesty               | Mobile agenda             | B   | Stage 3          | V-CNT-* / V-CONT-* / V-LINK-01 |
| Requests / Briefs          | `/app/requests`             | requests-1440                  | Workfront request + Planable brief | Inbox list                        | Sparse                | No drawer composer              | —                                   | —                         | M   | Stage 4          | V-REQ-01                       |
| Tasks kanban               | `/app/tasks`                | tasks-1440                     | Linear board                       | Columns exist                     | Cards undernourished  | DnD limited/absent              | Status honesty                      | —                         | B   | Stage 4          | V-TSK-01                       |
| Task detail                | tasks drawer                | —                              | Linear issue panel                 | Panel partial                     | —                     | Focus/esc                       | —                                   | Mobile sheet              | M   | Stage 4          | V-TSK-02                       |
| Deliverables               | `/app/deliverables`         | deliverables detail            | Planable content + Frame.io review | Light page review                 | **Not dark canvas**   | Approve local-only              | Version compare crude               | —                         | B   | Stage 5          | V-DEL-01                       |
| Reviews inbox              | `/app/reviews`              | reviews-1440                   | Planable My approvals              | List                              | Weak queue            | —                               | Links to brands only                | —                         | M   | Stage 5          | V-REV-01                       |
| Schedule                   | `/app/schedule`             | schedule-1440                  | Planable schedule                  | Preview calendar                  | Low density           | —                               | External off honesty OK             | —                         | M   | Stage 6          | V-SCH-01                       |
| Analytics                  | `/app/analytics`            | analytics-1440                 | Smartly/ops honesty                | Demo charts                       | Non-executive         | Date filters thin               | Demo disclosure OK                  | —                         | M   | Stage 6          | V-ANL-01                       |
| Team / Activity            | `/app/team` `/activity`     | team-1440                      | Linear members density             | Demo members                      | Sparse                | —                               | Link to company OK                  | Activity H1 weak          | M   | Stage 6          | V-ORG-01                       |
| Settings / Integrations    | `/app/settings`             | settings-1440                  | OMA honesty                        | Catalog OK                        | Flat                  | No fake connect                 | Deferred OK                         | —                         | m   | Stage 6          | V-ORG-02                       |
| Company members            | `/app/company/members`      | company-1440                   | Linear invite                      | Functional                        | Shell polish          | —                               | —                                   | —                         | m   | Stage 1–2 shell  | V-ORG-03                       |

---

## Stage 1 — Golden Design System + App Shell

**Routes:** all authenticated `app/*` chrome
**Components:** tokens, type, space, elevation, AppShell, Nav*, TopBar, TenantBrandSwitcher, PageHeader, Button, Input, Toast stub, Skeleton
**Reference evidence:** Linear archived shell notes; DEC-013 §3–5
**Done when:** V-SHELL-01…08 pass; no domain feature redesign required.

## Stage 2 — Command Center + Brand + Strategy

**Routes:** `/app`, `/app/brands/**`, strategy routes
**Components:** PageHeader, DataTable polish, StatusChip unify, Empty/Error
**Reference:** Linear density + Semrush/Jasper patterns (DOC/archived)
**Done when:** V-HOME-_, V-BWI-_, V-STR-* pass.

## Stage 3 — Campaigns + Content Planning

**Routes:** `/app/campaigns`, `/app/campaigns/[id]`, `/app/content`
**Components:** ContentCard, Calendar*, FilterBar, Tabs
**Reference:** Planable archived calendar/feed/grid/list/approvals patterns
**Done when:** V-CMP-_, V-CNT-_ pass; previews dominant; Organic/Paid unmistakable.

## Stage 4 — Requests + Tasks + Production

**Routes:** `/app/requests/**`, `/app/tasks`
**Components:** Kanban*, Drawer, CommentThread (light), structured Brief editor, Request inbox table
**Reference:** Linear board/drawer + Workfront workflow concepts + Planable content-link cues
**Evidence:** `artifacts/visual-parity-004/stage4-requests-tasks-production/` · `.reference/004-visual-parity/ours/stage4-requests-tasks-production/`
**Done when:** V-REQ-01/02, V-BRF-01, V-TSK-01/02/03, V-WRK-01, V-LINK-02 pass with Playwright + Demo API persistence (not screenshots alone).

## Stage 5 — Deliverables + Reviews

**Routes:** `/app/deliverables/**`, `/app/reviews`

**Components:** MediaReviewCanvas, VersionCompare, ApprovalActions, Annotation pins, Review queue

**Reference:** Frame.io DOC + Planable approvals archived (LIVE inspection optional; DOC-only default)

**Done when:** V-DEL-01, V-REV-01/02/03, V-VER-01, V-APR-01, V-WRK-02, V-LINK-03 pass; scoped dark canvas; immutable approved version UX clear; Task↔Deliverable handoff persisted.

**Stage 5 status:** implemented on `004-oma-complete-product-demo`.

## Stage 6 — Schedule + Analytics + Team + Settings

**Routes:** `/app/schedule`, `/app/analytics`, `/app/team`, `/app/activity`, `/app/settings`, `/app/company/members`

**Components:** Schedule calendar/agenda/queue, readiness drawer, sample analytics charts, team workload, activity stream, settings IA, integrations catalog

**Reference:** Planable schedule (DOC); Smartly analytics organization (DOC); Linear settings density (DOC); Workfront workload (DOC)

**Done when:** V-SCH-01/02, V-ANL-01/02, V-TEAM-01, V-ORG-01, V-ACT-01, V-SET-01, V-INT-01, V-LINK-04 pass with Playwright + Demo/Foundation ownership honesty.

**Stage 6 status:** implemented on `004-oma-complete-product-demo`.

## Stage 7 — Full visual certification

- Re-measure all surfaces vs Stage targets
- EN/AR · 1440/1024/390 · keyboard · reduced motion
- No false parity claims
- Full lifecycle Playwright + Owner Preview (`pnpm review:004` → `oma_ai_visual_cert_004`)
- Evidence: `artifacts/full-visual-certification-004/` · `.reference/004-visual-parity/ours/full-certification/`

**Done when:** Full Visual Certification PASS; Owner Preview READY; VISUAL_ACCEPTANCE remains PENDING_OWNER until owner decides.

**Stage 7 status:** certification pack on `004-oma-complete-product-demo`.

**Stage 7 status:** certification pack produced, then **invalidated by owner visual rejection**.

**Exit (historical):** `FULL_VISUAL_CERTIFICATION: PASS` + `OWNER_PREVIEW: READY` — **superseded**.

**Current binding status:**

- `OWNER_VISUAL_REVIEW: REJECTED`
- `VISUAL_REBUILD: COMPLETE`
- `OWNER_REMEDIATION_CERTIFICATION: PASS`
- `FULL_VISUAL_CERTIFICATION: SUPERSEDED`
- `OWNER_PREVIEW: READY` (launch on Final SHA)
- `VISUAL_ACCEPTANCE: PENDING_OWNER`
- `USER_ACCEPTANCE: PENDING`

**Core remediation stage:** `IMPLEMENT_OMA_OWNER_REJECTION_CORE_EXPERIENCE_REBUILD`
**Surface depth:** `IMPLEMENT_OMA_OWNER_REJECTION_SURFACE_DEPTH_REBUILD`
**Certification:** `CERTIFY_OMA_OWNER_REJECTION_REMEDIATION`
**Exact next:** `OWNER_PREVIEW_AND_ACCEPTANCE_OMA_REMEDIATED_VISUAL_PRODUCT`

---

## Counts

| Metric                 | Count          |
| ---------------------- | -------------- |
| OMA surfaces in matrix | 16             |
| Components specified   | 30+            |
| Interaction contracts  | 11 families    |
| Rebuild stages         | 7              |
| Blocker visual gaps    | 4 (VG-001…004) |
