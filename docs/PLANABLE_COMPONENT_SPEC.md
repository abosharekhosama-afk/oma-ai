# Planable component spec (OMA)

**Status:** SPEC only.
**Authority:** `DEC-017` · `docs/PLANABLE_UI_UX_BASELINE.md`
**Rule:** One OMA component kit in Planable visual language. Linear/Frame/Workfront chrome is not allowed.

## Shell

| OMA component                | Planable pattern                                          | Evidence                                            | Notes                                                                                      |
| ---------------------------- | --------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `AppShell`                   | Persistent 256px rail + content canvas `#F5F6F7`          | LIVE approvals/campaigns                            | Not Linear top-bar product                                                                 |
| `NavItem`                    | Content, Campaigns, Approvals, Inbox, Analytics, Channels | LIVE `data-cy`                                      | OMA labels stay OMA IA                                                                     |
| `WorkspaceSwitcher`          | `workspace-menu-button`                                   | LIVE + ARCHIVED menu                                | Do not copy Planable “New workspace” copy                                                  |
| `GlobalSearch`               | Rail search, 14px, radius 6                               | LIVE                                                |                                                                                            |
| `CreateControl`              | Primary 32×h, `#1677FF`, radius 6                         | LIVE `reviewPostsButton` as primary-shape reference | OMA create menu; never Planable “Upgrade”                                                  |
| `UserMenu` / `Notifications` | Rail footer / `notificationInbox`                         | LIVE presence                                       | Shared, actionable workspace utilities; icons stack vertically when the rail is collapsed. |
| `Breadcrumb`                 | `navBarBreadcrumbs`                                       | LIVE                                                | `{company} / {area} / {view}`                                                              |

### Shell navigation behavior

- Keep the primary navigation, Pages, and More groups in one compact vertical flow; do not stretch group gaps to fill the rail height.
- Pin the account and notifications actions to the bottom of the persistent rail on every workspace route. Keep both controls available in the mobile navigation drawer.
- In the expanded rail, the account and notifications controls share a footer row; in the collapsed rail, stack the icon controls vertically with accessible labels and working popovers/deep links.

## Content

| OMA component       | Planable pattern                                                             | Evidence                                                              |
| ------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `ViewSwitcher`      | Calendar / Feed / Grid / List / Approvals                                    | ARCHIVED LIVE menu; this run PARTIAL (selector missing on approvals)  |
| `FilterBar`         | Approval, post status, campaign, labels, period, type, author                | ARCHIVED LIVE                                                         |
| `ContentCalendar`   | Month/week cells, media thumbs, time, approval, comments                     | ARCHIVED LIVE; this-run calendar splash only                          |
| `ScheduleAgenda`    | Chronological, readable list with date/time and status                       | OMA adaptation                                                        | Single-column timeline; scrolls independently below the schedule controls. |
| `ScheduleQueue`     | Scan-friendly queue of planned work                                          | OMA adaptation                                                        | Responsive card grid; collapses to one column on narrow screens.           |
| `ContentFeed`       | Native-like stacked previews                                                 | ARCHIVED + DOC; direct `/feed` 404                                    |
| `ContentGrid`       | Instagram-style grid                                                         | PLAN_GATED this account; DOC + marketing inventory                    |
| `ContentList`       | Dense rows, bulk actions                                                     | PLAN_GATED; DOC bulk approve/schedule                                 |
| `ContentCard`       | Media-first, channel, status, comments                                       | ARCHIVED LIVE                                                         |
| `Composer`          | Modal: campaign, labels, Post/Story/Reels, editor, AI affordance, Save draft | ARCHIVED LIVE open/close no submit; this run control not on dashboard |
| `PostModal`         | Preview + status + schedule/publish honesty + right Feedback drawer          | ARCHIVED LIVE                                                         |
| `CommentThread`     | Author + relative time + mentions; internal vs external                      | ARCHIVED + DOC                                                        |
| `SuggestionTab`     | Select text to suggest                                                       | ARCHIVED empty + DOC                                                  |
| `ApprovalActions`   | Approve next to content; bulk review modal with skip/progress                | ARCHIVED LIVE opened/closed without decision                          |
| `CampaignPortfolio` | `/campaigns/{id}/all` tabs All/Active/Planning/Completed                     | LIVE route this run                                                   |
| `EmptyState`        | One illustration-free message + one primary CTA                              | ARCHIVED empty calendar/campaigns/analytics                           |
| `StatusChip`        | Text status; not color-only                                                  | ARCHIVED vocabulary                                                   |

## Overlays

| OMA component      | Planable pattern                              | Evidence                                      |
| ------------------ | --------------------------------------------- | --------------------------------------------- |
| `Modal`            | Centered dialog, `closeModal`, Escape         | ARCHIVED compose + review; LIVE close pattern |
| `Drawer`           | `post-modal-drawer` attached to content modal | ARCHIVED                                      |
| `Menu` / `Popover` | `role=menu`, pointer + Escape                 | ARCHIVED view/workspace menus                 |
| `DialogFooter`     | Primary 32px `#1677FF` + quiet secondary      | LIVE button metrics                           |

## OMA-only functions in Planable language

| OMA function                            | Visual rule                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Tasks Kanban                            | Same type, 6px radius, `#F5F6F7` canvas, 32px controls, Planable cards/menus/status chips. **No Linear board chrome.**   |
| Brand Intelligence / Strategy documents | Structured editor/workspace like Planable Universal Content / post editor density, not Jasper/Semrush visual systems.    |
| Workfront-style request inbox           | Planable list/approvals language (columns, filters, primary review action).                                              |
| Frame.io-style version lock             | Keep OMA immutable-version **logic**; present it as Planable activity + status next to preview, not a dark Frame player. |

## Forbidden visual imports

Linear issue panel, Linear command palette chrome, Frame.io dark theater, Workfront enterprise density, ClickUp board, marketing hero type.
