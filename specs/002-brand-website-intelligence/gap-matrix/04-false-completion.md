# False-Completion Findings — Feature 002

Tasks marked `[x]` that the running application at `1a7453c` does **not** prove. Each finding
reopens a task or adds a new one. No task is re-closed in this phase.

## Findings

### `FC-001` — Register-and-reach-app E2E hides the company dead end

| Field | Value |
| --- | --- |
| Evidence | `RT-10`, `RT-12`, `tests/e2e/auth-session.e2e.ts` |
| What the test claims | A newly registered user reaches `/app` with heading `Workspace`. |
| What the product does | The user has **zero memberships** and cannot use Brand Intelligence (`G-001`, `G-002`). |
| Gap | `G-001`, `G-002` |
| Action | Do not reopen a Feature 002 task for Foundation tenancy; add `T160` gated on `DEC-015`. Reopen nothing in `auth-session` itself (test change is implementation). Record that `auth-session.e2e.ts` is a known false positive. |

### `FC-002` — Brand journey E2E never uses login, tenant switcher, or create-brand UI

| Field | Value |
| --- | --- |
| Evidence | `RT-12`, `tests/e2e/helpers/brand-ui.ts`, `brand-api.ts` |
| What the suite does | Injects session cookies, creates tenants and brands via API, activates tenants via `page.evaluate`, then often `page.goto` to deep routes. |
| What it hides | Company-selector unusability (`G-003`), missing create-company UI (`G-001`), and any failure of the create-brand form path. |
| Gap | `G-001`, `G-003`, `G-005` |
| Action | Add `T161`–`T163` for UI-path E2E coverage. Do not reopen `T038` (pages exist and work when a company is active — proven by `RT-19`). |

### `FC-003` — `T136` claims complete EN/AR strings; a section heading leaks a key

| Field | Value |
| --- | --- |
| Evidence | `RT-21`, screenshot `41-profile-draft.png` |
| Task | `T136` |
| Gap | `G-010` |
| Action | **Reopen `T136` to `[ ]`.** Finding `FC-003`. |

### `FC-004` — `T130` review collaboration cues are unproven in product

| Field | Value |
| --- | --- |
| Evidence | `RT-20` — section renders; no comment posted |
| Task | `T130` |
| Gap | `G-016` |
| Action | **Reopen `T130` to `[ ]`.** Finding `FC-004`. Component existence is not journey proof. |

### `FC-005` — `T131` permission-denied state is unprovable without a second actor

| Field | Value |
| --- | --- |
| Evidence | Inventory `OMA-S32`; `G-018` |
| Task | `T131` |
| Gap | `G-018` |
| Action | **Reopen `T131` to `[ ]`** for the permission-denied claim only. Loading/empty/error states were observed. Finding `FC-005`. |

### `FC-006` — Phase VP status claims overstate readiness

| Field | Value |
| --- | --- |
| Evidence | `tasks.md` Phase VP block claims `VISIBLE PRODUCT BASELINE: DONE` while a self-registered user cannot obtain a company and the owner account's switcher is unusable at scale. |
| Gap | `G-001`, `G-002`, `G-003`, `G-005` |
| Action | Downgrade the Phase VP status line in `tasks.md` notes. Do not invent a completed VP task number. |

### `FC-007` — Insight decision E2E cannot be reached under the fixture connector

| Field | Value |
| --- | --- |
| Evidence | `RT-22` |
| Gap | `G-011` |
| Action | Add `T164` for a test-port-adapter UI journey. Do not reopen backend insight tasks that correctly gate on `AI_INFERRED` + `PENDING`. |

### Tasks deliberately **not** reopened

| Task | Reason |
| --- | --- |
| `T074` | Cancel/retry controls exist and work (`RT-25`, `brand-q-bwi-04`). |
| `T038` | Brand list/create pages work with an active company (`RT-19`). |
| `T139`–`T151` | Backend/API journeys largely hold; false positives are in the **helper path**, addressed by new UI-path tasks rather than blank reopenings of every Q-BWI id. |
| `T200`–`T208` | Untouched. |

## New tasks to add (before T200)

| ID | Gap | Responsibility |
| --- | --- | --- |
| `T160` | `G-001`/`G-002` | Spec + UI for company acquisition after `DEC-015` |
| `T161` | `G-003` | Searchable company selector |
| `T162` | `G-005` | E2E residue isolation / cleanup |
| `T163` | `FC-002` | E2E: register/login → select company → create brand by clicking only |
| `T164` | `G-011` | E2E insight accept/reject via test `AiProviderPort` |
| `T165` | `G-014` | E2E whole-version reject through UI |
| `T166` | `G-008` | E2E rescan-after-approval → new Draft |
| `T167` | `G-017` | Notifications surface (after invitation path) |
| `T168` | `G-018` | Invitation / membership surface after `DEC-015` |
| `T169` | `G-009` | Coverage subset disclosure verification |
| `T170` | `G-012` | Unknown-versus-missing field distinction |
| `T171` | `G-022` | Keyboard reachability verification (`NFR-BWI-005`) |
| `T172` | `G-023` | Motion measurement before assertion |
| `T173` | `G-024` | Decide unauthenticated `/` routing |

`G-004` / `G-006` / `G-021` remain decision- or scope-gated (`DEC-015`, `DEC-004`, or an explicit scope decision before building density controls). `G-010` is covered by reopening `T136`. `G-016` by reopening `T130`.

Final new task set: `T160`–`T173` (fourteen tasks).
