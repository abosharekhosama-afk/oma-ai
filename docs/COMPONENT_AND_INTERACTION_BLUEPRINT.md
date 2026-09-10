# Component and Interaction Blueprint

**Status:** READY — binds Stage 1–6 rebuilds  
**Authority:** DEC-013 + `docs/OMA_DESIGN_SYSTEM_BLUEPRINT.md`  
**Rule:** One OMA component system. Reference patterns inform behavior; never copy proprietary chrome.

## 1. Component inventory (implement once, reuse everywhere)

| Component                                     | Primary reference pattern          | OMA rules                                           |
| --------------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| `AppShell`                                    | Linear                             | Rail sections, collapse, top bar 56px               |
| `NavSection` / `NavItem`                      | Linear                             | Active = primary-soft + ink; keyboard list          |
| `TenantBrandSwitcher`                         | Linear workspace + OMA tenant SoT  | Searchable; shows company then brand                |
| `GlobalSearch`                                | Linear Cmd-K spirit                | Placeholder Stage 1; no fake results                |
| `PageHeader`                                  | Linear                             | Title 22/28 + muted lead + actions                  |
| `Button` primary/secondary/ghost/danger       | Linear quiet chrome                | radius-md; loading spinner; disabled opacity        |
| `IconButton`                                  | Linear                             | 32×32 hit target; aria-label required               |
| `Input` / `Textarea` / `Select`               | Linear dense                       | 14px text; radius-sm; focus ring primary            |
| `Checkbox` / `Radio` / `Switch`               | Linear                             | Non-color state text                                |
| `Tabs`                                        | Planable view switcher + Linear    | Underline or soft pill — pick one OMA style         |
| `FilterBar`                                   | Planable + Linear                  | Chip filters; clear-all; sticky under header        |
| `DataTable`                                   | Semrush density / Linear issues    | Sticky header; row hover; empty state slot          |
| `ContentCard`                                 | Planable                           | Media preview dominant; status chip; channel meta   |
| `StatusChip`                                  | Planable/Linear                    | Text + tone; mapped OMA statuses                    |
| `KanbanBoard` / `KanbanColumn` / `KanbanCard` | Linear                             | Valid-drop highlight; invalid reject                |
| `CalendarMonth` / `CalendarItem`              | Planable                           | Channel color key + preview thumb                   |
| `Drawer`                                      | Linear detail                      | 360–400px; Esc; focus trap; keep list scroll        |
| `Modal` / `ConfirmDialog`                     | Linear                             | Risk-proportional copy; no accidental spend/publish |
| `Popover` / `DropdownMenu`                    | Linear                             | elev-2; keyboard ↑↓ Esc                             |
| `Toast` / `NotificationBell`                  | Linear                             | Non-blocking; deep link                             |
| `Skeleton`                                    | Linear                             | Shape-matched; never imply completion for AI        |
| `EmptyState`                                  | Planable empty                     | One CTA; no dead ends                               |
| `ErrorState` / `DeniedState`                  | OMA                                | Actionable; no secret leak                          |
| `MediaReviewCanvas`                           | Frame.io                           | Dark only; version label; comment anchors           |
| `VersionCompare`                              | Frame.io / Semrush compare honesty | Two named versions; field/asset diff                |
| `CommentThread`                               | Planable + Frame.io                | Author, time, version scope                         |
| `ApprovalActions`                             | Planable                           | Approve / request changes / reject + history        |

## 2. Interaction contracts

### 2.1 Navigation

- Active route visible without color-only cue (weight + soft fill + `aria-current`).
- Collapse rail persists per user session.
- Deep links restore drawer state when specified.

### 2.2 Drawers

- Open from row/card without losing scroll position.
- Esc / backdrop / explicit close.
- Focus moves to drawer title; restore focus on close.

### 2.3 Filters

- URL-serializable where domain allows; demo surfaces may use local state until production APIs exist — label honesty unchanged.
- Empty filter result uses EmptyState, not blank page.

### 2.4 Calendar / Grid / List (Planable authority)

| View     | Must show                                              |
| -------- | ------------------------------------------------------ |
| Calendar | Month/week toggle; item preview thumb; status; channel |
| Grid     | Preview-dominant cards ≥ 160px media                   |
| List     | Dense rows with preview 40px + status + assignee       |

### 2.5 Kanban (Linear interaction + Workfront states)

- Columns = server-valid statuses only.
- Drag is UI gesture; invalid drop rolls back with toast.
- Card opens Drawer with checklist, comments, activity.

### 2.6 Media review (Frame.io only)

- Entering review switches to `--oma-review-canvas`.
- Comments bind to `versionId`; approved versions immutable.
- Compare is explicit A/B, not silent overwrite.

### 2.7 Approvals

- Confirm dialog for reject / request-changes when destroying work.
- History: actor, timestamp, decision, note.
- Demo local-only actions must keep honesty copy (not Stage 1 scope to remove demo).

### 2.8 Loading / empty / error / denied

| State   | Pattern                                   |
| ------- | ----------------------------------------- |
| Loading | Skeleton matching final layout            |
| Empty   | Illustration-free; one sentence + one CTA |
| Error   | Code-stable message + retry               |
| Denied  | Capability explanation + exit link        |

### 2.9 Keyboard

| Shortcut family | Behavior                      |
| --------------- | ----------------------------- |
| Tab / Shift+Tab | Visible focus ring            |
| Esc             | Close overlay                 |
| Enter           | Activate focused control      |
| Cmd/Ctrl+K      | Open search (Stage 1 stub OK) |

### 2.10 Responsive

| Viewport | Required                                                 |
| -------- | -------------------------------------------------------- |
| 1440     | Expanded rail + optional drawer                          |
| 1024     | Collapsible rail; tables scroll inside card              |
| 390      | No overflow; filters collapse; drawers full-screen sheet |

### 2.11 Motion

Per design system blueprint. Prefer opacity/transform only.

## 3. Status vocabulary (unify)

Map all product statuses through one chip dictionary (extend as domains mature):

`DRAFT`, `NEEDS_REVIEW`, `IN_REVIEW`, `CHANGES_REQUESTED`, `APPROVED`, `REJECTED`, `SCHEDULED`, `PUBLISHED_DEMO`, `ACTIVE`, `UPCOMING`, `OVERDUE`, `NOT_CONNECTED`, `DEFERRED`, scan states from 002, strategy states from 003.

## 4. Non-goals

- No new color systems per feature.
- No provider SDKs.
- No Frame.io chrome outside media review.
- No Planable/Linear assets or proprietary icons.
