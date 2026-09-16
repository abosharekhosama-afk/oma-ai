# Planable → OMA surface map

**Status:** Binding for rebuild stages P1–P7.
**Authority:** `DEC-017`
**Visual language:** Planable only. Functional logic from other products may remain; their UI must not.

| OMA surface        | Planable pattern                                                                                    | Evidence now                                                             | Rebuild stage |
| ------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------- |
| Command Center     | Workspace dashboard: cards, needs-attention, empty/onboarding                                       | LIVE dashboard 1440/1024/390                                             | P2            |
| Brands             | Workspaces / accounts as cards + switcher                                                           | LIVE dashboard cards + ARCHIVED switcher                                 | P2            |
| Brand Intelligence | Content-detail / structured editor language (sections, evidence beside canvas)                      | DOC Universal Content + ARCHIVED post editor density                     | P2            |
| Strategy           | Structured Planable editor/workspace (organic/paid as Planable labels/campaigns, not Jasper chrome) | DOC + ARCHIVED campaign linkage                                          | P2            |
| Campaigns          | Campaign workspace tabs All/Active/Planning/Completed                                               | LIVE `/campaigns/{id}/all`                                               | P3 COMPLETE   |
| Content            | Calendar / Grid / Feed / List                                                                       | ARCHIVED calendar+filters; LIVE splash only; Grid/List PLAN_GATED        | P3 COMPLETE   |
| Requests           | Inbox / list / approvals-queue language                                                             | ARCHIVED My approvals board                                              | P4            |
| Briefs             | Composer / editor                                                                                   | ARCHIVED compose modal                                                   | P4            |
| Tasks              | Board **in Planable cards/type/color/motion** (OMA function)                                        | No Planable Kanban LIVE                                                  | P4            |
| Deliverables       | Media grid / content assets                                                                         | ARCHIVED cards + DOC media library                                       | P5            |
| Reviews            | Content preview + comments + approvals                                                              | ARCHIVED post modal + bulk review                                        | P5            |
| Schedule           | Calendar / scheduling                                                                               | ARCHIVED calendar + DOC schedule                                         | P5            |
| Analytics          | Planable analytics empty/workspace charts language                                                  | ARCHIVED analytics empty; DOC reports                                    | P6            |
| Team               | Workspace members                                                                                   | DOC members/roles; LIVE `inviteMembersButton` presence only (not opened) | P6            |
| Activity           | Collaboration activity list                                                                         | ARCHIVED `activityList`                                                  | P6            |
| Settings           | Workspace settings IA                                                                               | Company Settings link ARCHIVED (not opened); `SANDBOX_DATA_REQUIRED`     | P6            |

## Rebuild sequence (docs only — no product code in this stage)

| Stage  | Scope                                                                   | Start condition                                                                                                            |
| ------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **P1** | Planable tokens, typography, shell, navigation, base components, motion | This baseline is `COMPLETE`. Implementation starts only when `IMPLEMENT_OMA_PLANABLE_UI_UX_REBUILD_STAGE_P1` is requested. |
| **P2** | Command Center, Brands, Brand Intelligence, Strategy                    | After P1 tokens/shell land                                                                                                 |
| **P3** | Campaigns, Content Calendar/Grid/Feed/List, Composer                    | After P2                                                                                                                   |
| **P4** | Requests, Briefs, Tasks/Kanban in Planable language                     | After P3                                                                                                                   |
| **P5** | Deliverables, Reviews, Schedule                                         | After P4                                                                                                                   |
| **P6** | Analytics, Team, Activity, Settings                                     | After P5                                                                                                                   |
| **P7** | Full visual parity certification + owner preview                        | After P1–P6                                                                                                                |

Do not start any implementation stage from this document.

## Gaps Planable does not own visually

OMA still owns: tenant isolation, capability gates, Organic vs Paid as domain tracks, AI provenance, immutable deliverable versions, honest “not connected” integrations. Express them with Planable chips, banners, and drawers — never with Linear/Frame visual systems.
