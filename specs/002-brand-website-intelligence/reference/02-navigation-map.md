# Navigation Map — Feature 002 Reference Products

All routes are patterns. Real workspace, team, project, post and issue identifiers are replaced
with `{placeholders}`. Everything below is what was actually observed live, or what an official
documentation page states; nothing is reconstructed from memory.

## Semrush

| Level | Observed |
| --- | --- |
| Application | `www.semrush.com` — single host. `app.semrush.com` does not resolve. |
| Workspace | Not observable. The authenticated product shell never rendered because the account has no active paid subscription. |
| Main navigation (live) | Home, SEO, AI, Traffic & Market, Local, Content, Ad, AI PR, Social, Reports, Apps. A collapsible left sidebar is toggled by an "Open navigation sidebar" control. |
| Global controls (live) | Global analysis combobox "Enter website or keyword" plus an Analyze button; a "Go to tool…" tool-search combobox acting as an app switcher (its listbox stays empty until typed into). |
| Site Audit entry (live) | `/siteaudit/` renders a public "Project setup" form with a single `Enter domain` combobox and a `Start SEO Audit` button. `/siteaudit/projects/` redirects back to `/siteaudit/`. |
| Site Audit sections (documented) | Overview, Issues, Crawled Pages, Statistics, Compare Crawls, Progress, and thematic reports: Robots.txt, Crawlability, HTTPS Implementation, International SEO, Performance, Internal Linking, Markups, Core Web Vitals. |
| Site Audit setup (documented) | A five-step wizard: step 1 General settings (Scope, Limit per audit, Pages to crawl, Schedule) is required; steps 2–5 (Crawler settings, Allow/disallow rules, URL parameter rules, Restrictions to bypass) are optional and can be skipped to start with defaults. Settings are editable afterwards through a settings gear → "Audit settings". |
| Panels / detail (documented) | Per-issue detail view listing every affected URL; Single Page view inside Crawled Pages showing page attributes and Issues Found with "How to fix"; "How to fix" popover on each issue; Site Structure breakdown by subdomain/subfolder. |
| Relevant visible settings (documented) | Audit settings (all wizard steps), exclude-checks via settings gear, hidden-issues restore, re-run schedule, crawl-budget usage under the profile's subscription info. |
| Route patterns | Product report routes are not published in the Knowledge Base, so only `/siteaudit/` and `/siteaudit/projects/{projectId}` are recorded. |

## Planable

| Level | Observed |
| --- | --- |
| Application | `app.planable.io` for the product; `help.planable.io` for the Help Center; `planable.io/product/` for the product page. |
| Workspace model | Company → workspaces → pages/channels → posts. Two workspaces existed in the account: one empty and one populated sample workspace. |
| Main navigation (live) | `/dashboard` workspace list; per-workspace destinations `/calendar/{workspaceId}`, `/approvals/{workspaceId}`, `/campaigns/{workspaceId}/all`, `/analytics/{workspaceId}`, `/e/{workspaceId}/comments`. |
| View switcher (live) | Calendar, Feed, Grid (PRO badge), List (ENT badge), My approvals, plus a CUSTOM VIEWS group with "Create a custom view". Views are reachable only through this menu — direct navigation to `/feed/{workspaceId}` returns a page-not-found error. |
| Workspace switcher (live) | Current company and workspace, workspace list, Settings, Members, New workspace, Upgrade subscription, Switch company. |
| Company menu (live) | Upgrade plan, Usage, Billing (deliberately not opened), Settings, Rename company, Members, Invite collaborators. |
| Page-level controls (live) | Filter, Media, Share, Compose, Request approvals, view selector, workspace switcher, user dropdown, channel checkboxes, a calendars popover, display settings, Month/Week toggle. |
| Tabs (live) | Approvals queue sections Awaiting approval / Feedback left / Approved; campaign tabs All / Active / Planning / Completed; composer tabs Post / Story / Reels; notification tabs Approvals / Feedback / Social inbox / Updates / Unreads; filter tabs Approval Status / Post Status / Feedback & Activity / Campaign / Labels / Period / Post Type / Content / Author. |
| Panels (live) | Post detail modal at `/calendar/{workspaceId}/{postId}` with a right-hand drawer carrying a Feedback section (Comments and Suggestions tabs) and an Activity log; a Filter & Sort panel; a bulk-approval selection panel; a notifications panel; a sequential review modal at `/approvals/{workspaceId}/approve`. |
| Relevant visible settings (documented) | Workspace Settings → Approval Settings: approval workflow (None / Optional / Required [Pro] / Multi-level [Enterprise]), "Who can approve Content?", "Lock Content after Approval", "Schedule posts automatically on Approval", "Automatic reminders for pending approvals". Members settings → permissions tab. Workspace default "Create new posts as internal". |

## Linear

| Level | Observed |
| --- | --- |
| Application | `linear.app` for the product; `linear.app/docs` for official documentation. |
| Workspace | One workspace with one team. Routes recorded as `/{workspace}/team/{team}/...`. |
| Layout zones (live, measured) | Left sidebar 330 px when expanded (pushed off-canvas at x −346 at the observed 967 px viewport) + main content column ≈967 px + an optional right detail panel 318 px starting at x ≈620. |
| Sidebar hierarchy (live) | Top block: Workspace Menu, Search, Create new issue. Then Inbox, My issues, Agent. Then a `Workspace` group: Projects, Views. Then a `Your teams` group with the team expanding to Home, Issues, Projects, Views. Then a "Show more links" affordance revealing Members, Teams, Customize sidebar. Then a `Try` group: Import, Invite, Connect GitHub. A "Join a team" entry is present. |
| Collapsed vs expanded (live) | At a narrow viewport the sidebar is off-canvas and is reopened from a Menu button inside the main content area. |
| Page hierarchy (live) | Header with team context, an `Issues` heading, Add to favorites and Setup team notifications; then view tabs Active / Backlog / All issues plus "Add new view"; then a toolbar with Add filter, Display options, Open details and Collapse group; then a grouped list with a group header carrying its own count. |
| Pages visited (live) | `/{workspace}/team/{team}/all`, `/my-issues/assigned`, `/projects/all`, `/views/issues`, `/{workspace}/team/{team}/cycles`, `/{workspace}/issue/{issueId}/...`, `/{workspace}/settings/account/preferences`. |
| Panels (live) | Issue detail as a right side panel in list context and as a full page; a filter dialog; a Display options panel; the Cmd+K command menu; the Help menu. |
| Relevant visible settings (live) | `/{workspace}/settings/account/preferences` exposes a Theme selector with System / Light / Dark. It was read and left unchanged, because selecting a theme would persist a preference. |
| Mobile navigation (documented) | The mobile application exposes Home, Inbox, Create, Search and Settings tabs, and PWA installation is supported. |

## Jasper Brand IQ

| Level | Observed |
| --- | --- |
| Application | No product application was opened. There is no OMA-owned Jasper account and signup was refused, so the status stays `AUTH_REQUIRED / REFERENCE_LIMITED`. |
| Sources | Official `jasper.ai` product pages, official Jasper documentation and the official Jasper Help Center only. |
| Navigation | Not observable. Any product navigation, workspace model, section hierarchy, tab set or panel layout for Brand IQ is `UNKNOWN` for this baseline. |

See `01-evidence-log.md` for the specific documentation pages behind every documented row above.
