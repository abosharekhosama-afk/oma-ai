# Planable / OMA visual differential baseline

**Date:** 2026-09-23  
**Served SHA at capture:** `bda4d8254de61ef20a5d68481a0a06e7e703a5c1`  
**Database:** `oma_ai_visual_cert_004`  
**Redis:** `redis://127.0.0.1:6379/3` prefix `oma-visual-cert-004`  
**Ports:** web 3000, api 3001, worker 3002  
**Seed:** `packages/db/prisma/seed-review-003.ts`

## Access

Planable live session was already signed in on the OMA References profile. Inspection stayed read-only. Compose was not opened. No workspace was created.

| Evidence                          | Level                 | What it shows                                                           |
| --------------------------------- | --------------------- | ----------------------------------------------------------------------- |
| EV-PL-dashboard-1440 / 1024 / 390 | LIVE_VERIFIED         | Workspace picker, search, upgrade, new-workspace control                |
| EV-PL-sample-calendar             | LIVE_VERIFIED         | Month/week calendar, Saved column, approved cards, filter, channels     |
| Feed / List / Grid                | REFERENCE_UNAVAILABLE | View menu was not captured. Help Center EV-HC-CAL names the four views. |
| Composer                          | OFFICIAL_HELP         | Not opened live, to avoid creating a draft. EV-HC-SCHED                 |

OMA before shots: 85 viewport captures under `artifacts/planable-oma-visual-differential/before/`. Empty, error, hover, and focus states are `NOT_REPRODUCIBLE` in this pass.

## W1 comparison

| Surface                     | Class          | Measured gap                                                                                                                                                                              |
| --------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calendar + Saved            | PARTIAL        | Planable shows a Saved column of undated drafts beside the month grid. OMA before had no Saved column.                                                                                    |
| Feed / List / Grid          | PARTIAL        | OMA has the four controls. Planable live frames for those views were not taken.                                                                                                           |
| Draft versus Schedule       | WRONG before   | OMA stored a date on `scheduledAt` and exposed Scheduled as a status.                                                                                                                     |
| Approval filters            | MISSING before | Planable filters include Not approved, Partially approved, Pending my approval, Approved. This wave implements Not requested, Pending, Approved only. Partially approved is not invented. |
| Approval policy             | MISSING before | None / Optional / Required were not settings.                                                                                                                                             |
| Card anatomy, type, density | WRONG          | Not matched to the live calendar cards.                                                                                                                                                   |
| Motion timings              | UNKNOWN        | Not measured.                                                                                                                                                                             |

`PLANABLE_W1_VISUAL_DIFFERENTIAL: NOT_PASS` while those high gaps remain.

## W1 final closure

Measured on 2026-09-23 after `min-height: 172px` on `.oma-post-card--calendar` only. Computed style at 1440×900, reduced motion off:

| Property   | Planable live      | OMA                | Delta |
| ---------- | ------------------ | ------------------ | ----- |
| width      | 126px              | 126px              | 0     |
| height     | 172px              | 172px              | 0     |
| padding    | 6px                | 6px                | 0     |
| radius     | 8px                | 8px                | 0     |
| border     | rgb(226, 227, 229) | rgb(226, 227, 229) | 0     |
| transition | 150ms ease-out     | 0.15s ease-out     | 0     |

Feed, List, and Grid remain `OFFICIAL_DOC_VERIFIED` for the reference and `VERIFIED_OMA_ADAPTATION` for the product. The measured card meets the live box. The stage stays `PLANABLE_W1_VISUAL_DIFFERENTIAL: NOT_PASS` until the integration login gate is green. Owner review stays `REJECTED`.
