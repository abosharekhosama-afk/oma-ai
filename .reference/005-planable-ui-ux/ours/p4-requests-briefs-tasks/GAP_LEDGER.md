# P4 Gap ledger — Requests / Briefs / Tasks

**Stage:** `IMPLEMENT_OMA_PLANABLE_UI_UX_REBUILD_STAGE_P4`  
**REFERENCE_SESSION:** `NOT_REQUIRED — APPROVED_BASELINE_SUFFICIENT`  
**Authority:** DEC-017 · Planable sole UI/UX

| ID | Surface | Gap vs Planable / brief | Resolution | Status |
| --- | --- | --- | --- | --- |
| G-P4-01 | Requests inbox | Dense collaboration list with filters/groups | Rebuilt `stage4.css` + inbox rows (avatar, updatedAt, filters, mobile stack) | CLOSED |
| G-P4-02 | Create Request | P1 Dialog + validation + unsaved warning | Dialog with dirty close confirm; Demo API create + reload | CLOSED |
| G-P4-03 | Request detail | No card-stack triage | Compact header + triage fields + links + activity honesty | CLOSED |
| G-P4-04 | Structured Brief | Composer/document canvas | TOC + canvas sections; explicit Save; Ready gate; no AI/upload claims | CLOSED |
| G-P4-05 | Tasks IA | Board default; List; My Work | Board + List + filters + URL `view`/`task`. My Work **not shipped** (no current-user assignee in Demo graph) | CLOSED (honest limit) |
| G-P4-06 | Kanban chrome | Linear/purple/giant cards | Planable compact columns, drag affordance, overlay, a11y select | CLOSED |
| G-P4-07 | Within-column reorder | Persistence | Declared `data-reorder-persistence="local-only"` — cross-column API only | CLOSED (honest limit) |
| G-P4-08 | Task drawer | P1 Drawer + deep link | Existing drawer restyled; Escape/focus; checklist/comments persist | CLOSED |
| G-P4-09 | Journey | Request→Brief→Convert→Board→Drawer | Stage 4 Playwright proves UI path without API shortcuts | CLOSED |
| G-P4-10 | Legacy tokens in stage4 | `--oma-violet` / `--oma-signal` / `--motion-micro` | Removed from `stage4.css`; remaining aliases documented for P5/P6 | CLOSED |

Open for later stages only: P5 deliverables/reviews; P6 analytics/settings alias deletion.
