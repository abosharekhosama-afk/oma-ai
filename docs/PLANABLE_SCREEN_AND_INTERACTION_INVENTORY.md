# Planable screen and interaction inventory

**Access date:** 2026-09-23.  
Measurements, colors, and motion timings are `UNKNOWN` unless a live session records them. This stage did not open the live app.

| Screen                | Purpose                    | Entry                              | Layout known from docs                           | Primary actions                                   | States                                         | Evidence                     |
| --------------------- | -------------------------- | ---------------------------------- | ------------------------------------------------ | ------------------------------------------------- | ---------------------------------------------- | ---------------------------- |
| Workspace home views  | Plan posts                 | Views menu                         | Feed, Calendar, List, Grid                       | Switch view, filter, select pages                 | Empty via filters                              | EV-HC-CAL                    |
| Feed                  | Native-looking previews    | View switcher                      | Post preview with nearby feedback                | Approve, comment                                  | `UNKNOWN` empty copy                           | EV-MKT-HOME                  |
| Calendar              | Week or month across pages | View switcher; mobile views button | Saved column for undated posts; day cells; notes | Drag to date or timeslot; Schedule; Publish now   | Undated vs dated                               | EV-HC-CAL, EV-HC-SCHED       |
| Grid                  | Instagram grid planning    | View switcher                      | Includes natively published posts                | Drag to reorder grid                              | Approved vs needs work is named, not specified | EV-MKT-HOME                  |
| List                  | Compact overview           | View switcher                      | `UNKNOWN` columns                                | Bulk actions are named on marketing               | `UNKNOWN`                                      | EV-HC-CAL, EV-MKT-HOME       |
| Custom view           | Saved filter set           | Views menu                         | Named view over any base view                    | Save, reopen, share URL (snippet)                 | Pending / scheduled / approved presets         | EV-HC-CUSTOM                 |
| Composer              | Create or edit a post      | Create; mobile create              | Date/time optional                               | Save draft, Schedule, Publish now, Mark published | Draft grey icon                                | EV-HC-SCHED                  |
| Filter & Sort         | Narrow the view            | Filter control                     | Grouped criteria                                 | Apply, clear with x                               | Team-only vs everyone                          | EV-HC-FILTER                 |
| Approval settings     | Workspace policy           | Workspace menu → settings          | Four workflow types plus two toggles             | Choose workflow; lock; auto-schedule              | None / Optional / Required / Multi-level       | EV-HC-WS                     |
| Post approval control | Decide a post              | Hover approval icon                | Tooltip with Request Approval                    | Request, Approve, Unapprove                       | Not approved, partial, pending me, approved    | EV-HC-APPROVAL, EV-HC-CUSTOM |
| Publishing icon       | Show publish state         | Left of each post                  | Platform icon variants                           | Hover for failure reason                          | See state map                                  | EV-HC-STATUS                 |
| Workspace create      | New client space           | Create workspace                   | Ends on approval workflow                        | Invite later, then assign approvers               | Approvers not assignable during create         | EV-HC-WS                     |
| Brand context         | Voice for AI writing       | Workspace settings                 | Tone, values, terminology, audience              | Edit; choose client visibility                    | Owners/editors                                 | EV-CHG-HOME                  |
| Analytics             | Reports                    | Named on marketing and API         | `UNKNOWN` screen anatomy                         | Sync metrics; competitor add-on                   | `PLAN_GATED` add-on                            | EV-HC-API, EV-CHG-V2         |
| Public API token      | Connect tools              | Help article                       | Token starts with `pln_`                         | Generate, share, revoke                           | Pro/Enterprise                                 | EV-HC-API, EV-CHG-V2         |

## Interaction rules that are proven

- Hover reveals Request Approval. `EV-HC-APPROVAL`
- Hover on a bad publish icon reveals the reason. `EV-HC-STATUS`
- Drag moves a post between dates or into a timeslot, and from Saved onto the calendar. `EV-HC-CAL`
- Selecting a date is not the Schedule command. `EV-HC-SCHED`
- Keyboard shortcuts are named on the marketing calendar section and are otherwise `UNKNOWN`. `EV-MKT-HOME`
- Responsive: mobile has a views button and can scroll weeks and create a post. Breakpoints are `UNKNOWN`. `EV-HC-CAL`
- Dialogs, drawers, and focus rings are `UNKNOWN` in this official-doc pass.
