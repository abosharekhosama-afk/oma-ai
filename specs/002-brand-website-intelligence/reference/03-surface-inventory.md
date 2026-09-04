# Surface Inventory — Feature 002 Reference Products

Every surface carries a status. `LIVE_VERIFIED` means the surface was rendered and read in a
signed-in session. `DOC_VERIFIED` means an official documentation page describes it and the live
surface was not rendered. `REFERENCE_LIMITED` means access or plan gating prevented verification.
`REFERENCE_LIMITED_NEEDS_SANDBOX_DATA` means the surface exists but requires data or a subscription
the OMA-owned account does not have. Evidence ids resolve in `01-evidence-log.md`.

Field lists are the reference product's own vocabulary, recorded for pattern study only. They are
not OMA field names and authorize no OMA schema.

---

## Semrush

### SEM-S-001 — Top-level navigation

- **Status:** `LIVE_VERIFIED` · **Route:** `/home/` · **Evidence:** `EV-SEM-001`
- **Purpose:** Locate where website analysis lives among the product's top-level areas.
- **Fields:** none (navigation links only).
- **Controls:** global analysis combobox "Enter website or keyword" + Analyze; "Go to tool…" tool-search combobox as app switcher; top-level areas Home, SEO, AI, Traffic & Market, Local, Content, Ad, AI PR, Social, Reports, Apps; "Open navigation sidebar" toggle.
- **States:** navigation collapses to a sidebar toggle at the observed viewport; the tool-search listbox is empty until typed into.
- **Actors:** any authenticated user.
- **Relevance to 002:** where a website-intelligence destination sits in a broad product, and how a global "analyze a website" entry coexists with sectioned navigation.
- **Unknowns:** the authenticated app-shell side-nav groups (Projects and similar) were never rendered.

### SEM-S-002 — Site Audit public entry / project setup form

- **Status:** `LIVE_VERIFIED` · **Route:** `/siteaudit/` · **Evidence:** `EV-SEM-001`
- **Purpose:** the single entry point that starts a website audit.
- **Fields:** `Enter domain` : combobox with autocomplete : required : no default.
- **Controls:** `Start SEO Audit` (opened as an entry point; never submitted).
- **States:** empty state with no projects listed.
- **Actors:** any authenticated user.
- **Relevance to 002:** OMA's Connect Website surface — a single-URL entry that precedes configuration.
- **Unknowns:** the dialog behind `Start SEO Audit` was not opened because the account cannot proceed without a subscription.

### SEM-S-003 — Site Audit configuration UI (live)

- **Status:** `REFERENCE_LIMITED_NEEDS_SANDBOX_DATA` · **Route:** `/siteaudit/projects/{projectId}` · **Evidence:** `EV-SEM-001`
- **Purpose:** the live crawl-configuration surface.
- **Fields / controls / states:** not observed. `/siteaudit/projects/` redirects to the public marketing page.
- **Relevance to 002:** OMA's scan setup surface.
- **Unknowns:** all live field names, input types, required markers, defaults, inline validation copy and error styling. Requires an active Semrush subscription plus a provisioned Site Audit project.

### SEM-C-001 — Setup: crawl scope

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-002`, `EV-SEM-003`
- **Fields:** `Scope` : domain, subdomain or subfolder to crawl : required : defaults to the root domain. `Crawl all subdomains` : checkbox : optional : checked by default, which crawls the root domain including all subdomains and subfolders.
- **States:** root domain including subdomains, limited subdomain, limited subfolder.
- **Before/after:** to limit the crawl the operator must both name the subdomain or subfolder and clear "Crawl all subdomains".
- **Relevance to 002:** the first configuration decision is _what part of the site counts_, decided before any bound on volume.

### SEM-C-002 — Setup: page limit per audit

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-002`, `EV-SEM-004`
- **Fields:** `Limit per audit` : pages crawled per run : required : no documented single default.
- **States:** the ceiling is subscription-tiered (documented as 20,000 pages per audit on two tiers and 100,000 on the highest, against separate monthly totals).
- **Before/after:** monthly crawl budget is tracked separately from the per-audit limit, under the profile's subscription information.
- **Relevance to 002:** a bounded scan needs both a per-attempt limit and a visible cumulative budget, and the two are different numbers.
- **Unknowns:** the default value shipped in the wizard.

### SEM-C-003 — Setup: crawl source

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-002`
- **Fields:** `Pages to crawl` : one of Website, Robots.txt sitemap, Sitemap by URL, Import URLs from file : required : defaults to Website.
- **States:** Website performs breadth-first discovery from the homepage by following links; Robots.txt sitemap uses only URLs in the sitemap referenced by robots.txt; Sitemap by URL takes one sitemap at a time; Import URLs from file accepts a `.csv`/`.txt` with one URL per line and the wizard reports the detected URL count back to the operator.
- **Before/after:** choosing a sitemap or file conserves crawl budget relative to open link discovery.
- **Relevance to 002:** OMA's public-HTTPS crawl needs an explicit source choice, and the reference echoes the parsed URL count back before starting.

### SEM-C-004 — Setup: crawler user agent

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-002`
- **Fields:** `User agent` : SiteAuditBot (Desktop), SiteAuditBot (Mobile) or OpenAI-Search : required : defaults to SiteAuditBot (Mobile).
- **Controls:** a dropdown, with the resolved user-agent string shown beneath the field and copyable so the operator can reproduce the request themselves.
- **Before/after:** the documentation states Googlebot identities are no longer offered, while campaigns previously configured with Googlebot keep using it until changed — an explicit legacy-value carry-forward rather than a silent migration.
- **Relevance to 002:** provenance of _which fetcher produced this data_ must be recorded per attempt, matching `FR-BWI-019a`.

### SEM-C-005 — Setup: crawl delay

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-002`
- **Fields:** `Crawl delay` : Minimum, 1 URL per 2 seconds, or Respect robots.txt : required : defaults to Minimum.
- **States:** Minimum is roughly one second between pages; the middle option throttles to one URL every two seconds for sites without a crawl-delay directive; Respect robots.txt follows the site's own `Crawl-delay`.
- **Before/after:** a slower delay lengthens the audit but reduces the load the crawl imposes on real visitors.
- **Relevance to 002:** rate limiting is presented to the operator as a courtesy trade-off, not hidden in server configuration.

### SEM-C-006 — Setup: allow / disallow subfolders

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-002`
- **Fields:** `Allow subfolders` : optional. `Disallow subfolders` : optional. Multiple paths may be entered at once, expressed as the path after the TLD.
- **Before/after:** a trailing slash is semantically load-bearing — entering `/shoes` rather than `/shoes/` also excludes any URL merely starting with `/shoes`, such as `/shoes-men`.
- **Relevance to 002:** URL rules need documented matching semantics and a validation story, or operators silently over-exclude.

### SEM-C-007 — Setup: URL parameter rules

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-002`
- **Fields:** parameters to ignore : optional; each named parameter is stripped for every value.
- **States:** with a parameter stripped, `/shoes` and `/shoes/?page=1` collapse to one URL crawled once.
- **Relevance to 002:** canonical-URL handling and duplicate suppression happen at configuration time, before extraction.

### SEM-C-008 — Setup: restrictions to bypass

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-002`, `EV-SEM-004`
- **Fields:** `Bypass disallow rules in robots.txt and meta robots tag` : optional : requires uploading a product-provided verification file to the site root, that is, proof of ownership. `Crawl with my credentials` : username and password for protected areas : optional. `Crawl with Web Bot Auth signature` : Signature Agent, Signature Input and Signature fields : optional.
- **States:** the product detects a bot-blocking platform and prompts the operator to resolve it from the interface rather than failing opaquely.
- **Relevance to 002:** the reference gates robots bypass behind ownership verification. OMA's 002 slice deliberately does **not** bypass robots (`FR-BWI-011`) and uses an attestation checkbox rather than cryptographic ownership (`FR-BWI-010`), so this is a divergence to preserve, not a pattern to copy.

### SEM-C-009 — Setup: schedule

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-002`, `EV-SEM-005`
- **Fields:** `Schedule` : Weekly on a chosen day, Daily, or Once : required.
- **States:** "Once" stops automatic re-runs for that campaign while manual re-runs stay available at any time.
- **Relevance to 002:** recurring scans are a named configuration value with an explicit manual-only option.
- **Unknowns:** whether a schedule-completion email notification exists is not stated on the pages opened.

### SEM-C-010 — Setup: JavaScript rendering and resource handling

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-002`, `EV-SEM-006`, `EV-SEM-007`, `EV-SEM-008`
- **Fields:** `JS rendering` : on/off : optional : off by default, meaning only HTML is read.
- **Controls:** a toggle, available only on the higher subscription tiers.
- **Before/after:** enabling rendering changes the health score because more content becomes visible to the checks — the same site produces a different result under a different fetch mode.
- **Relevance to 002:** fetch mode materially changes extracted observations, which is exactly why `FR-BWI-019a` requires the connector mode to be recorded on the attempt and read back from that record.
- **Unknowns:** no separate resource-crawling toggle is documented; JS and CSS coverage is expressed through individual checks.

### SEM-C-011 — Setup: validation and error presentation

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-002`, `EV-SEM-004`
- **States:** "Auditing domain has failed" indicates the server is blocking the crawler; a DNS resolution failure indicates the entered host is offline, commonly a root-versus-`www` redirect problem; "You've reached the limit for simultaneously run campaigns" indicates a concurrency ceiling; the bypass option refuses to engage until ownership verification succeeds.
- **Before/after:** a failed crawl produces a downloadable log file the operator can forward to whoever administers the site.
- **Relevance to 002:** failure reasons are actionable and attributable to a cause, and the product hands the operator an artifact to act on rather than a generic error.
- **Unknowns:** inline field-level validation copy beyond the above.

### SEM-C-012 — Setup: required versus optional steps

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-002`, `EV-SEM-009`
- **States:** a five-step wizard where only step 1 (Scope, Limit per audit, Pages to crawl, Schedule) is required; steps 2–5 are skippable and the audit starts with defaults. Settings remain editable later from a settings gear.
- **Relevance to 002:** a bounded scan is startable from a minimal required set, with advanced configuration available but never mandatory.

### SEM-C-013 — Runtime: progress presentation

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-010`, `EV-SEM-011`
- **Fields:** a crawled-pages counter; a crawling-details dropdown surfaced on the reports themselves.
- **States:** while crawling, the counter advances; after the counter stops there is a documented delay while the last stage checks external links and images and persists results; a crawl stuck beyond 24 hours is a support case.
- **Relevance to 002:** progress must distinguish "fetching" from "finishing", or a stalled counter reads as a hang. This supports OMA's separate `Crawling` / `Extracting` / `Analyzing` states.
- **Unknowns:** the queued-state label is not documented.

### SEM-C-014 — Runtime: crawl date and retention display

- **Status:** `REFERENCE_LIMITED` · **Evidence:** `EV-SEM-012`, `EV-SEM-013`, `EV-SEM-014`
- **Fields:** crawl dates appear as date drop-downs in the comparison surface; data is retained up to one year after the last crawl.
- **Unknowns:** a specific "last updated" label on the audit header is **not** documented on the pages opened. Recorded as limited rather than asserted.

### SEM-C-015 — Runtime: stop a running crawl

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-011`, `EV-SEM-012`
- **Fields:** a minimum number of pages must be crawled before stopping is offered at all; once offered, the operator chooses to stop and save results, or to discard the crawl and preserve crawl budget.
- **Controls:** a square stop control beside the crawled-pages count.
- **Before/after:** stopping and saving presents an unfinished crawl as the current audit — the reference lets incomplete data become the displayed truth.
- **Relevance to 002:** OMA diverges deliberately. A bounded incomplete run is `Partial` and carries mandatory incompleteness disclosure before approval (`FR-BWI-029a`), instead of being presented as up to date.
- **Unknowns:** the exact minimum page threshold is documented as existing but never quantified.

### SEM-C-016 — Runtime: re-run audit and re-audit a single page

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-012`, `EV-SEM-008`, `EV-SEM-009`
- **Controls:** a "Rerun campaign" action for the whole audit; a per-row Reaudit control in the crawled-pages report for one page.
- **Before/after:** a re-run refreshes and **replaces** the previous results; single-page re-audit is offered specifically to track remediation without spending full crawl budget.
- **Relevance to 002:** OMA diverges deliberately. A rescan must create a new Draft version and must not replace an Approved version (`FR-BWI-031`, `FR-BWI-030`).

### SEM-C-017 — Runtime: crawl history and retention

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-012`, `EV-SEM-013`
- **Fields:** comparison across any two past audits back to the first; a progress graph over time; retention of up to one year after the last crawl.
- **States:** if a campaign is re-run within twelve months its data is kept; older crawl data is removed on an ongoing basis; if never re-run, results and settings are removed automatically after a notification.
- **Before/after:** the operator is told to export before removal if the history matters.
- **Relevance to 002:** history has an explicit lifetime and the product warns before discarding it — relevant to `DEC-012` retention rather than to 002 behaviour.

### SEM-C-018 — Runtime: failure states

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-004`, `EV-SEM-002`
- **States:** robots.txt disallow blocking the crawler; `noindex`/`nofollow`/`none` tags blocking pages; an unreachable host or DNS failure from a root-versus-`www` misconfiguration; a page or its JS/CSS exceeding a documented size ceiling; a monthly budget or simultaneous-campaign limit reached; zero pages crawled, attributed to a blocked crawler, `noindex` tags or DNS. A settings change plus re-run raises an explicit "your crawler settings have changed since your previous audit" notice.
- **Relevance to 002:** each failure names a cause and a remedy, blocked resources are never reported as analysed, and a configuration change that invalidates comparability is surfaced rather than absorbed.
- **Unknowns:** verbatim message text for the zero-pages case.

### SEM-D-014 — Results: Overview and Site Health

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-013`, `EV-SEM-015`
- **Fields:** a Site Health score out of 100 with an industry comparison; crawled pages split into healthy, broken, has-issues, redirects and blocked; Errors, Warnings and Notices counts; Top Issues ordered by priority with affected page counts; an AI-search health widget; a "blocked from AI search" widget derived from robots.txt.
- **Controls:** click an issue count to open its detail; "View all issues"; an industry drop-down for score comparison.
- **Before/after:** the score updates on re-run, and errors are weighted more heavily than warnings.
- **Relevance to 002:** a single headline coverage/health figure sits above a severity breakdown, and pages are classified by fetch outcome — directly comparable to OMA's coverage summary and discovered-pages classification.

### SEM-D-015 — Results: Issues report

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-016`
- **Fields:** three severity tiers where Notices explicitly do not affect the health score; affected-page counts; a per-issue trend sparkline linking to the progress view; a "how to fix" explanation available even for issues not currently present.
- **Controls:** severity tabs; hide an issue behind an eye control with a "Hidden" tab and restore; bulk exclusion of checks from settings; hand-off to external trackers.
- **Before/after:** hiding or excluding an issue removes it from the health calculation, and the score only reflects that after a re-run — the reference is explicit that the number lags the decision.
- **Relevance to 002:** severity vocabulary, remediation guidance attached to the finding, and the honesty of stating that a derived score is stale until recomputed.

### SEM-D-016 — Results: per-issue evidence view

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-016`
- **Fields:** the full list of URLs carrying the selected issue; an issue switcher; URL search; combinable advanced filters over issue status, crawl depth and HTTP status.
- **Relevance to 002:** every finding resolves to the concrete source URLs that produced it — the core of OMA's evidence panel requirement (`FR-BWI-023`).

### SEM-D-017 — Results: crawled pages report

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-008`
- **Fields:** a configurable column set including internal link rank, page URL, blocked AI bots, title, description, status code, issue count, crawl depth, pageviews, load time, markup, structured data, canonicalization, sitemap membership, incoming and outgoing link counts, AMP link, hreflang, JS/CSS file counts and sizes, and a per-row reaudit; a single-page view combining page attributes with the issues found and their remediation links; a site-structure breakdown by subdomain and subfolder with issue counts.
- **Controls:** manage columns, search, advanced filters, sort, open the live page, reaudit one page.
- **Relevance to 002:** the discovered-pages surface OMA needs — canonical URL, fetch status, HTTP status and classification per page, with drill-down to that page's own findings.

### SEM-D-018 — Results: statistics report

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-006`
- **Fields:** HTTP status-code distribution including pages with no status code; sitemap versus crawled pages; crawl depth distribution; incoming internal links; markup types covering Schema.org Microdata and JSON-LD, Open Graph, Twitter Cards and Microformats; AMP link share; canonicalization; hreflang usage.
- **Controls:** a tile/graph toggle, with charts clicking through to a pre-filtered page list.
- **Relevance to 002:** structured-data and metadata signals in `FR-BWI-020b` are presented as coverage statistics with a path from the aggregate straight to the affected pages.

### SEM-D-019 — Results: thematic reports

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-017`
- **Fields:** Robots.txt with a direct "open file" affordance, Crawlability, HTTPS Implementation, International SEO limited to HTML hreflang, Performance, Internal Linking, Markups, and Core Web Vitals over a small sampled page set.
- **Before/after:** each theme shows movement since the previous crawl in a positive or negative treatment.
- **Relevance to 002:** grouping findings by theme, and being explicit about the sampled subset a metric was computed over.

### SEM-D-020 — Results: compare crawls and progress

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-012`
- **Fields:** a side-by-side comparison of any two audits selected by date, reporting fixed and newly appeared issue counts between them; a progress graph with a From/To range across general, error, warning and notice metric groups.
- **Relevance to 002:** version comparison expressed as _what changed between two identified runs_, which is the shape of OMA's draft-versus-approved comparison (`US-BWI-05`).

### SEM-D-021 — Results: export affordance

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-SEM-014`
- **Fields:** distinct export sets for crawled pages, crawled pages with a column per potential issue, crawled pages with markup, issues with movement since the last audit, and a crawl comparison defaulting to the two most recent crawls; a relative-versus-absolute URL choice; a PDF export of the current tab.
- **Relevance to 002:** export affordance and shape only. Nothing was exported, and `FR-BWI-025` export/removal remains deferred to `DEC-012`.

---

## Planable

### PLA-001 — Dashboard / workspace list

- **Status:** `LIVE_VERIFIED` · **Route:** `/dashboard` · **Evidence:** `EV-PLA-001`
- **Purpose:** entry point listing workspaces and exposing workspace creation.
- **Fields:** a card per workspace showing name, page count and last activity; a "Create a workspace" card; an "Other workspaces" section.
- **Controls:** New workspace; a company menu containing Upgrade plan, Usage, Billing, Settings, Rename company, Members, Invite collaborators.
- **States:** one card per workspace; an empty-state card when none exist.
- **Actors:** the inspecting account could view the dashboard. Whether every membership role can view it, and whether the company menu is restricted to owner/admin, is `UNKNOWN` — no permission boundary was tested (`06-role-permission-matrix.md`).
- **Relevance to 002:** workspace-per-brand organisation, and a company level that owns membership above the workspace.
- **Unknowns:** Usage and Billing contents — deliberately not opened. Role restrictions on the company menu.

### PLA-002 — Calendar (primary planning surface)

- **Status:** `LIVE_VERIFIED` · **Route:** `/calendar/{workspaceId}` · **Evidence:** `EV-PLA-001`
- **Fields:** Month/Week toggle; a breadcrumb of company / section / view; day cells offering post and note creation; a right-hand saved-items panel whose empty state reads as "no saved posts, your drafts will appear here".
- **Controls:** Filter, Media, Share, Compose, Request approvals, view selector, workspace switcher, user menu, per-channel checkboxes, a calendars popover, display settings.
- **States:** an empty workspace shows an onboarding checklist with an explicit completion percentage and per-step ticks; the populated workspace shows posts per day with campaign labels and notes.
- **Actors:** observed for the inspecting account only. That the approval entry points appear only for approvers is an **inference** from control labelling, not a tested permission boundary.
- **Relevance to 002:** a populated primary surface with per-item status, and an empty state that tells a new user what to do next rather than showing a blank grid.

### PLA-003 — View switcher

- **Status:** `LIVE_VERIFIED` · **Evidence:** `EV-PLA-001`
- **Fields:** Calendar, Feed, Grid with a plan badge, List with a plan badge, My approvals, and a custom-views group with a creation entry.
- **States:** two views are plan-gated and say so inline on the menu item itself.
- **Relevance to 002:** one dataset, several review-oriented presentations, with entitlement stated at the point of choice.
- **Unknowns:** views are reachable only through this menu; direct navigation to a view route returns a page-not-found error.

### PLA-004 — Workspace switcher

- **Status:** `LIVE_VERIFIED` · **Evidence:** `EV-PLA-001`
- **Fields:** current company and workspace, the workspace list, Settings, Members, New workspace, Upgrade subscription, Switch company.
- **Relevance to 002:** switching brand context is a first-class control that also carries the scope's settings and membership entries.

### PLA-005 — Create workspace wizard

- **Status:** `LIVE_VERIFIED` (opened, never submitted) · **Evidence:** `EV-PLA-001`
- **Fields:** step 1 — workspace name, website URL as a typed URL input, workspace timezone with a searchable default. Step 2 — invite email, a permission selector defaulting to Approver, a membership selector defaulting to Team, plus "add more collaborators" and "invite later". Step 3 — channel connection tiles including a "Universal Content" non-social option, plus "connect later". Step 4 — approval workflow as None, Optional, Required (plan-gated) or Multi-level (plan-gated).
- **Controls:** Next, Go back, Finish, Invite later, Connect later, close.
- **States:** four wizard steps; the two stronger approval workflows carry plan badges.
- **Relevance to 002:** governance is chosen at workspace creation, and every step after identity is skippable. The approval workflow is a property of the scope, not of the individual item.

### PLA-006 — My approvals (approval queue)

- **Status:** `LIVE_VERIFIED` · **Route:** `/approvals/{workspaceId}` · **Evidence:** `EV-PLA-002`
- **Fields:** three counted sections — awaiting approval, feedback left, approved — each with its own empty-state sentence rather than a shared blank.
- **Controls:** an "approve all" action and a "review posts" action, both disabled at zero.
- **States:** fully empty in the empty workspace; populated with counts in the sample workspace.
- **Actors:** approvers.
- **Relevance to 002:** a personal review queue separating what is waiting on me, what I have responded to, and what is settled — and disabling bulk actions rather than hiding them.

### PLA-007 — Sequential review flow

- **Status:** `LIVE_VERIFIED` (opened, no decision made) · **Route:** `/approvals/{workspaceId}/approve` · **Evidence:** `EV-PLA-002`
- **Fields:** an item-of-total progress indicator with a progress bar; the item preview; the existing comment thread inline; a comment input.
- **Controls:** previous, next, skip, approve, close.
- **States:** per-item progress with skip and approve transitions.
- **Relevance to 002:** reviewing many items one at a time with full context, where skipping is a legitimate outcome that is neither approval nor rejection.
- **Unknowns:** no reject action exists in this flow — only approve and skip.

### PLA-011 — Post detail modal (item review surface)

- **Status:** `LIVE_VERIFIED` · **Route:** `/calendar/{workspaceId}/{postId}` · **Evidence:** `EV-PLA-003`
- **Fields:** campaign label, labels, share; a status chip; the channel name; the content; link preview cards; a desktop/mobile preview toggle; a timeline carrying the approve control and the schedule/publish control; a drawer with a Feedback section split into Comments and Suggestions tabs, and an Activity log with per-row entries.
- **Controls:** approve, schedule/publish, comment input, preview toggle, drawer tabs, AI rewrite and hashtag helpers.
- **States:** status chips observed live include "not approved yet", "approved by {user}", approved, pending, draft and scheduled; the activity log carries actor-plus-relative-time entries; the suggestions tab has its own empty state instructing the user to select text.
- **Actors:** observed for the inspecting account only (`EV-PLA-003`). That view/comment/approve/edit are split by role is **`DOC_VERIFIED`** via `EV-PLA-006`/`EV-PLA-008` for documented capability text; enforcement was not tested and remains `UNKNOWN`.
- **Relevance to 002:** the canonical item-level review surface — status, content, evidence of prior discussion, decision control and history in one stable context. Directly informs OMA's insight review and evidence panel.
- **Unknowns:** the per-post overflow menu was not opened, and version restore was not exercised because it would mutate content.

### PLA-012 — Filter and sort panel

- **Status:** `LIVE_VERIFIED` · **Evidence:** `EV-PLA-004`
- **Fields:** a sort selector; filter tabs for approval status, post status, feedback and activity, campaign, labels, period, post type, content and author; a within-posts search; a "hide team only posts" switch; a "show archived posts" switch.
- **States:** every filter option carries a live count. Approval status distinguishes approved, not approved, **partially approved**, pending my approval, and requested by me. Post status distinguishes scheduled, not scheduled, published, not published, no date set, marked as published, published as ad, published as draft, failed to publish, incompatible content, and imported. Feedback and activity distinguishes comments, suggestions, internal notes and resolved comments.
- **Relevance to 002:** the status vocabulary is deliberately non-overlapping — approval state, publication state and discussion state are three separate axes, never one blended status. "Partially approved" is a first-class state, which is the shape of OMA's Partial disclosure.

### PLA-013 — Bulk approval request (selection mode)

- **Status:** `LIVE_VERIFIED` (entered and exited without sending) · **Evidence:** `EV-PLA-004`
- **Fields:** a selected-count readout, select all, send for approval, exit selection mode.
- **States:** selection mode is a distinct mode with its own panel; the send action stays disabled until something is selected.
- **Relevance to 002:** requesting review over a set is a different action from deciding on one item, and the reference models them as separate modes.

### PLA-014 — Composer

- **Status:** `LIVE_VERIFIED` (opened, never submitted) · **Evidence:** `EV-PLA-004`
- **Fields:** template, campaign, labels; content-type tabs; the editor; AI generation; save draft.
- **Relevance to 002:** creation produces a draft that then enters the review queue — creation and approval are separate lifecycle stages.

### PLA-015 — Notifications panel

- **Status:** `LIVE_VERIFIED` · **Evidence:** `EV-PLA-005`
- **Fields:** tabs for approvals, feedback, social inbox, updates and unreads; a "mark all as read" action, disabled when nothing is unread; notification rows phrased as an actor requesting or granting approval on a named item, each with a thumbnail, channel name and relative timestamp.
- **Controls:** tabs; mark all read; opening a row deep-links to the item.
- **Relevance to 002:** review work is delivered as a notification that deep-links straight to the deciding surface, and approval notifications are separated from general feedback.
- **Unknowns:** the notification-preferences screen was not opened.

### PLA-016 — Approval workflow settings

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-PLA-006`, `EV-PLA-007`
- **Fields:** four workflow types — None hides the approval affordance entirely; Optional allows publishing with or without approval; Required blocks scheduling or publishing without at least one approver; Multi-level is plan-gated. Additional settings cover who may approve, "lock content after approval", and automatic scheduling on approval.
- **States:** configured per workspace.
- **Actors:** workspace administrators.
- **Relevance to 002:** locking content after approval is the reference's immutability mechanism, and it is reversible by un-approving. OMA's approved version is immutable outright (`FR-BWI-030`), which is a deliberate divergence.
- **Unknowns:** the live settings screen was not opened.

### PLA-017 — Approve / unapprove a post

- **Status:** `LIVE_VERIFIED` + `DOC_VERIFIED` · **Evidence:** `EV-PLA-003`, `EV-PLA-008`
- **Fields:** a single approval control; a resulting "approved by {user}" status; re-clicking un-approves, subject to permission.
- **States:** not approved → approved by a named actor, and back.
- **Actors:** users holding the approve permission; a single approver suffices under the default workflow.
- **Relevance to 002:** approval attribution is visible on the item itself. The reversibility is the divergence: OMA's approval is terminal for that version and a correction creates a new version.

### PLA-019 — Feedback drawer (comments)

- **Status:** `LIVE_VERIFIED` + `DOC_VERIFIED` · **Evidence:** `EV-PLA-003`, `EV-PLA-009`
- **Fields:** threads with author, timestamp and mentions; a comment input; reply, react and resolve actions.
- **States:** resolved comments are hidden behind a toggle rather than deleted.
- **Actors:** all members; external guests via review links may comment only.
- **Relevance to 002:** discussion is preserved, resolution is a visibility change rather than a destruction, and review history survives the decision.

### PLA-021 — Suggestions (inline edit proposals)

- **Status:** `LIVE_VERIFIED` (empty state) + `DOC_VERIFIED` · **Evidence:** `EV-PLA-003`, `EV-PLA-010`
- **Fields:** a reviewer selects text and proposes exact replacement copy; suggestions collect in their own tab.
- **Controls:** accept or reject in one action; accepting rewrites the content.
- **States:** empty, pending, accepted, rejected.
- **Actors:** reviewers propose; the item owner disposes.
- **Relevance to 002:** the closest reference analogue to OMA's per-insight accept/reject/edit disposition — a proposal is inert until a human disposes of it, and the disposition is recorded separately from the content.

### PLA-022 — Internal notes

- **Status:** `DOC_VERIFIED`, with a live filter count confirming the feature is in use · **Evidence:** `EV-PLA-004`, `EV-PLA-011`
- **Fields:** a separate visually distinct tab, visible only to team membership, supporting tagging of team members only.
- **Relevance to 002:** internal deliberation is partitioned from client-visible discussion at the data level, not by convention.

### PLA-023 — Review links / external share

- **Status:** `DOC_VERIFIED`, with the share control present live · **Evidence:** `EV-PLA-012`, `EV-PLA-013`, `EV-PLA-014`
- **Fields:** an item link letting an account-less guest view the item and prior non-internal comments; a view link sharing a filtered view with an access setting and a dynamic time range.
- **States:** public versus workspace access; links are revocable.
- **Actors:** external guests may comment and suggest but **cannot approve**.
- **Relevance to 002:** external participation is deliberately capped below the approval boundary — the reference refuses to let an unauthenticated link grant a decision.
- **Unknowns:** the live share dialog rendered no readable content in this session.

### PLA-024 — Internal / external item visibility

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-PLA-011`, `EV-PLA-015`, `EV-PLA-014`
- **Fields:** Team versus Client/External membership types; a per-item visibility control; a workspace default that creates new items as internal; a bulk reveal action.
- **States:** internal items carry a distinct visual treatment for the team.
- **Relevance to 002:** drafts are hidden by default and revealed deliberately, so a reviewer never sees work before it is offered for review.

### PLA-029 — Post status vocabulary

- **Status:** `LIVE_VERIFIED` (filter option set) + `DOC_VERIFIED` · **Evidence:** `EV-PLA-004`, `EV-PLA-016`
- **Fields:** draft, scheduled, published, cannot-be-scheduled with a hover reason, failed to publish, marked as published, platform-specific draft and dark-post states, and imported.
- **Controls:** hover reveals the reason a blocked state is blocked.
- **Relevance to 002:** a blocked state is never a bare icon — the reason is attached to it. This is the pattern behind OMA's requirement that blocked resources are not reported as analysed.

### PLA-030 — List view (bulk actions)

- **Status:** `DOC_VERIFIED` (plan-gated live) · **Evidence:** `EV-PLA-017`
- **Fields:** columns for content snippet, file type, status, author, labels, channel and datetime; a bulk action bar including approve, request approval, copy elsewhere, schedule/unschedule, hide/unhide, label, archive/restore and publish actions.
- **Relevance to 002:** a dense tabular review surface where the decision actions operate on a selection.

### PLA-031 — Feed view

- **Status:** `DOC_VERIFIED` (reachable only through the view menu) · **Evidence:** `EV-PLA-018`
- **Fields:** an as-published rendering with real channel chrome, scrollable, with per-item open, approve, schedule and label actions.
- **Relevance to 002:** reviewing an item as it will actually appear, rather than as stored fields.

### PLA-033 — Activity log and version history

- **Status:** `LIVE_VERIFIED` (activity log) + `DOC_VERIFIED` (version restore) · **Evidence:** `EV-PLA-003`, `EV-PLA-019`, `EV-PLA-013`
- **Fields:** activity entries naming actor, action and relative time; documented previous-version listing with restore.
- **Actors:** all members may read; editors may restore.
- **Relevance to 002:** history is reachable from the item it belongs to. The divergence is direction: the reference restores a prior version in place, whereas OMA creates a new version and preserves the approved artifact.
- **Unknowns:** restore was not exercised because it mutates content.

### PLA-034 — Conceptual model

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-PLA-020`
- **Purpose:** company → workspaces → channels → items, with collaboration anchored beside every item and the approval workflow configured per workspace.
- **Relevance to 002:** confirms that the review model is scoped by workspace, which maps onto OMA's brand-workspace scoping.

### PLA-036 — Campaigns, analytics and social inbox

- **Status:** `LIVE_VERIFIED` (shell and empty states only) · **Evidence:** `EV-PLA-021`
- **Purpose:** recorded to bound scope. Campaigns showed an empty state with a creation entry and lifecycle tabs; analytics showed an empty state; the social inbox rendered a paid-add-on preview.
- **Relevance to 002:** none directly. Recorded so the navigation map is honest about what else occupies the shell.

---

## Linear

Measured values were read from computed styles in the live DOM at a 967 px-wide viewport with a
device pixel ratio of 2. They are recorded as measurements at that viewport, not as design tokens,
and no colour is transcribed as an OMA value.

### LIN-001 — Product shell / application frame

- **Status:** `LIVE_VERIFIED` · **Route:** `/{workspace}/team/{team}/all` · **Evidence:** `EV-LIN-001`
- **Layout zones:** a left navigation sidebar, a main content column, and an optional right detail panel.
- **Measured:** sidebar 330 px expanded; off-canvas at x −346 when collapsed; main column ≈967 px; detail panel 318 px starting at x ≈620.
- **Controls:** workspace menu, search, create-new, help menu, sidebar links, and a menu button inside the main content that reopens the collapsed sidebar.
- **States:** sidebar expanded on wide viewports, off-canvas on narrow ones.
- **Relevance to 002:** the three-zone shell OMA's intelligence workspace uses, and the fact that the detail panel is a peer of the list rather than a replacement for it.

### LIN-002 — Sidebar navigation

- **Status:** `LIVE_VERIFIED` · **Evidence:** `EV-LIN-001`
- **Fields:** an action block (workspace menu, search, create), then personal destinations, then a workspace group holding cross-team destinations, then a per-team group that expands into its own destinations, then a progressive-disclosure "show more" affordance for administrative links, then an onboarding group.
- **States:** groups independently collapsible; secondary links hidden until requested.
- **Relevance to 002:** navigation is grouped by scope — personal, workspace, team — and administrative entries are demoted behind disclosure instead of competing with daily destinations.

### LIN-004 — Page hierarchy

- **Status:** `LIVE_VERIFIED` · **Evidence:** `EV-LIN-001`
- **Fields:** a header carrying scope context, the page heading and page-level actions; a view-tab row with an add-view affordance; a toolbar carrying filter, display options, detail-panel toggle and group collapse; then a grouped list whose group headers carry counts.
- **Measured:** list row height 44 px.
- **States:** groups expandable and collapsible; list or board presentation.
- **Relevance to 002:** a repeatable page skeleton — context, saved views, view controls, then data — that OMA can reuse across brand, pages and insight lists.

### LIN-005 — Detail panel and detail page

- **Status:** `LIVE_VERIFIED` · **Evidence:** `EV-LIN-001`
- **Fields:** in panel form, the item detail beside the list; in full-page form, a title, a rich description, an activity feed with a comment form, and a right-hand property rail.
- **Measured:** panel width 318 px.
- **States:** panel open or closed; the same object addressable as a panel or a page.
- **Relevance to 002:** OMA's evidence side panel must preserve the operator's position in the list, and the same object needs a deep-linkable full page.

### LIN-006 — Filters

- **Status:** `LIVE_VERIFIED` · **Evidence:** `EV-LIN-002`
- **Fields:** a filter dialog listing filterable properties, with per-option counts on the status values, plus a natural-language filter entry and an advanced-filter entry.
- **States:** dialog open; individual property menus expandable.
- **Relevance to 002:** filters are additive and discoverable from one dialog, and option counts tell the operator whether a filter will return anything before they apply it.

### LIN-007 — Display options

- **Status:** `LIVE_VERIFIED` · **Evidence:** `EV-LIN-002`, `EV-LIN-005`
- **Fields:** a list/board switch; a grouping selector including an explicit "no grouping"; an ordering selector; sub-grouping, direction, sub-item inclusion; and a toggle set choosing which properties are displayed on a row.
- **Relevance to 002:** density is a user-controlled property. Which columns appear on a row is a preference, not a fixed layout — relevant to OMA's discovered-pages and insight lists.

### LIN-008 — Keyboard interaction

- **Status:** `LIVE_VERIFIED` · **Evidence:** `EV-LIN-003`
- **Fields:** a command menu opened by a keyboard shortcut, presenting an ask-mode tab and commands that display their own shortcut inline, including chorded and sequenced forms.
- **Controls:** `?` opens the help menu, whose keyboard-shortcuts entry opens documentation in a new tab.
- **Relevance to 002:** shortcuts are taught inside the command surface the operator already uses, so the keyboard model is discoverable without a separate manual.
- **Unknowns:** no in-application shortcut modal exists, and the dedicated documentation route returned not-found, so the full shortcut inventory is `UNKNOWN`.

### LIN-009 — Motion

- **Status:** `LIVE_VERIFIED` · **Evidence:** `EV-LIN-004`
- **Measured:** at the observed viewport the sidebar navigation transition computed to 0 s, and the command-menu overlay computed to no animation and 0 s transition.
- **Relevance to 002:** the interaction reference's calm character is achieved partly by not animating, which supports OMA's restrained-motion direction and its reduced-motion requirement.
- **Unknowns:** motion at other viewports was not measured, so no general claim about the product's motion durations is made. `INFERENCE` if extended beyond the measured case.

### LIN-010 — Empty states

- **Status:** `LIVE_VERIFIED` · **Evidence:** `EV-LIN-006`
- **Fields:** the personal-issues empty state pairs a plain sentence with the creation action; the projects and views empty states pair an illustration and explanation with both a creation action and a documentation link; the views empty state also teaches its keyboard shortcut; the cycles empty state is a single explanatory sentence.
- **Relevance to 002:** every empty state names the missing thing and offers the next action, and some teach the shortcut — directly usable for OMA's mandatory empty states under `FR-BWI-033`.

### LIN-011 — Loading behaviour

- **Status:** `LIVE_VERIFIED` · **Evidence:** `EV-LIN-004`
- **Measured:** on navigation between the observed pages, no loading indicator was present — no busy state and no loading elements in the DOM.
- **Relevance to 002:** the reference avoids spinners on fast local transitions. OMA still requires explicit loading states for genuinely asynchronous work such as scans, where `FR-BWI-033` applies.
- **Unknowns:** behaviour on a slow or cold load was not observed.

### LIN-012 — Row hover and selection treatment

- **Status:** `LIVE_VERIFIED` · **Evidence:** `EV-LIN-004`
- **Measured:** row height 44 px; hover and selection are rendered through a pseudo-element background behind the row rather than by changing the row's own background; the selected state additionally sets explicit selected and active data attributes; the two backgrounds are measurably distinct.
- **States:** default, hover, selected — three visually separable states, with selection also exposed in the accessibility/DOM layer rather than by colour alone.
- **Relevance to 002:** selection must be conveyed in more than colour, which satisfies the non-colour status requirement OMA carries.

### LIN-013 — Account preferences (theme)

- **Status:** `LIVE_VERIFIED` (read only) · **Route:** `/{workspace}/settings/account/preferences` · **Evidence:** `EV-LIN-007`, `EV-LIN-008`
- **Fields:** a theme selector offering system, light and dark.
- **Relevance to 002:** theme is an account preference with a system-following default, which matters for OMA's light-first operational surface and dark review canvas model.
- **Note:** the selector was read and left untouched, because choosing a value would persist a preference.

### LIN-014 — Responsive and mobile model

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-LIN-009`
- **Fields:** the documented mobile application exposes home, inbox, create, search and settings destinations, and installation as a progressive web application is supported.
- **Relevance to 002:** on small viewports the reference reduces to a small set of destinations plus a create action, rather than compressing the desktop sidebar.
- **Unknowns:** OMA's responsive requirement under `NFR-BWI-005` was not proven against live Linear breakpoints; only the collapse behaviour at the observed viewport was seen.

---

## Jasper Brand IQ

Every Jasper entry is documentation-derived. No signed-in Jasper session exists, so no Jasper field
list, state, actor or layout is `LIVE_VERIFIED`, and none may be treated as proof of internal
product behaviour. Official Help Center articles are treated as stronger evidence than
`jasper.ai` marketing pages, and marketing-only claims are flagged inline.

### JAS-001 — Brand intelligence layer positioning

- **Status:** `DOC_VERIFIED` (Help Center) with `REFERENCE_LIMITED` marketing framing · **Evidence:** `EV-JAS-001`, `EV-JAS-002`, `EV-JAS-003`
- **Purpose:** an explicit brand-context layer that stores brand voice, visual identity, audience personas and approved source material, then applies that context automatically to generation surfaces. Brand IQ is the brand-governance subset of that layer.
- **Fields:** the Help Center enumerates six components — brand voice, knowledge base, audiences, visual guidelines, style guide, and a product-intelligence component. The marketing page groups them differently into four, which is a naming divergence between the two sources and is recorded as such rather than reconciled.
- **Controls:** a single collapsible card split into content and context sections, whose collapsed state shows how many components are active; adding a source is one tabbed dialog accepting text, a URL or a file.
- **States:** per-component active or inactive; card collapsed or expanded.
- **Actors:** all users may view and use; creation and editing are governed by workspace permission settings.
- **Relevance to 002:** this is the closest reference concept to OMA's brand intelligence profile — a named, governed context object rather than a free-text brand description.
- **Unknowns:** internal UI behaviour was not observed. The marketing-only component grouping is not corroborated by documentation.

### JAS-002 — Brand profile organisation

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-JAS-001`
- **Purpose:** brand information is organised into separately named components rather than one monolithic profile record.
- **Fields:** brand voice covers tone, style, personality and explicitly on-brand versus off-limits words and phrases; the knowledge base covers product details, key messaging, FAQs and competitive positioning; audiences covers personas, segments and markets; visual guidelines covers colour, typography, imagery style and design standards; the style guide covers punctuation, branded terminology and capitalisation; the product component covers specifications, pricing, claims, differentiators, approved messaging and disclaimers.
- **Controls:** each component has its own create-and-edit flow and its own visibility setting; groups can segment components.
- **States:** per component — created or empty, private or workspace-visible.
- **Relevance to 002:** directly informs OMA's requirement that the profile is divided into named identity sections (`FR-BWI-026`) rather than presented as a data dump.
- **Unknowns:** no single bundling "brand profile" entity is documented, and no ordering or precedence between components is stated.

### JAS-003 — Brand voice

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-JAS-004`, `EV-JAS-005`, `EV-JAS-003`
- **Purpose:** define a voice from the brand's own existing writing; the product analyses tone, style and characteristics and then applies the voice to outputs.
- **Fields:** a name; a description carrying tone attributes; a "best used for" note; a visibility setting; a bounded number of examples supplied as text, documents or URLs; a generated description with optional excerpts that the operator can enable for accuracy; a recently-used list.
- **Controls:** add and edit; a preview across several content types; a with-voice versus without-voice comparison generating both versions side by side; save; delete and recreate; a workspace-default voice that only an administrator may set and that any user may override per generation.
- **States:** created or draft; private or workspace-visible; default or overridden.
- **Actors:** members and administrators may see and use a non-private voice; only administrators set the workspace default; create, edit and delete are restricted by permission settings.
- **Relevance to 002:** the derived description is presented as generated content the human can inspect and correct, and the comparison view shows the operator exactly what the brand context changed. That is the reference behaviour behind OMA's proposal-not-decision rule (`FR-BWI-021`, `FR-BWI-028`).
- **Unknowns:** generation-time behaviour was not observed.

### JAS-004 — Knowledge organisation

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-JAS-006`, `EV-JAS-007`
- **Purpose:** a documented container that "houses all the facts of your business", reusable across generation.
- **Fields:** knowledge assets each carrying a name, optional tags and a visibility setting; content spanning products, pricing, company values, market positioning, target audiences, voice and tone guidance and brand identity; sources accepted as text, audio, image, bounded-length video, documents and URLs.
- **Controls:** an add-knowledge flow ordered as upload, name, tag, set visibility, confirm; assets are consumed per surface with a documented ceiling on how many attach at once; asset content is chunked and only relevant chunks are used; editability differs by source type — text uploads are editable, uploaded documents are downloadable but not editable, and URL-derived assets are neither.
- **States:** private or public; editable or read-only depending on source type.
- **Actors:** users manage their own assets unless permission settings restrict it.
- **Relevance to 002:** editability is a property of provenance. A URL-derived asset cannot be edited in place, which is the same instinct as OMA keeping observations immutable and expressing corrections as new human decisions.

### JAS-005 — Source-backed brand information

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-JAS-004`, `EV-JAS-006`, `EV-JAS-008`, `EV-JAS-007`
- **Purpose:** brand information is derived from and grounded in operator-supplied sources.
- **Fields:** accepted sources include text, documents, URLs, audio, image and video; the documentation states the product **crawls** a website to find sufficient text to determine a brand voice, explicitly contrasted with scraping it; the product component analyses knowledge-base and web sources to draft a schema and auto-populate attributes; the style guide imports a small bounded number of source documents.
- **Controls:** URL-derived assets are cached for a documented short period and fetched at generation time rather than refreshed on a schedule; crawl failure is handled with named remedies — supply a valid HTTPS URL, try a different URL, or paste example text directly.
- **States:** source attached or absent; crawled and cached; auto-populated or empty.
- **Relevance to 002:** the reference names its fetch semantics, states the freshness window, and gives the operator a manual fallback when the crawl fails — all three matter for OMA's connector-provenance requirement (`FR-BWI-019a`) and its manual completion path (`FR-BWI-028b`).
- **Unknowns:** "transparent sourcing and citations" appears only as a marketing claim; no citation surface is documented in the Help Center, so per-claim source display is `UNKNOWN` for this reference.

### JAS-006 — Missing and unknown information

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-JAS-008`
- **Purpose:** the documentation explicitly distinguishes "the source did not surface this attribute" from "this information does not exist".
- **Fields:** auto-populated attribute fields where an empty field carries that specific documented meaning; gaps are closed by editing details, adding or swapping context sources, or re-mapping attributes; custom attributes are supported.
- **Controls:** the documentation instructs the operator to have the product owner review and verify key fields, singling out claims, disclaimers and specifications; it recommends a single accountable owner and a recurring review cadence.
- **States:** auto-populated versus empty; drafted versus verified.
- **Actors:** a named product owner is the recommended verifier.
- **Relevance to 002:** this is the strongest documented precedent for OMA's rule that absence is `Unknown` rather than invented, and that a human verifies claim-bearing fields before they are trusted (`FR-BWI-020`, `FR-BWI-022`).
- **Unknowns:** no confidence scoring and no explicit first-class "known unknown" state is documented, so OMA's evidence-state taxonomy is stricter than the reference.

### JAS-007 — Reviewable brand guidance

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-JAS-004`, `EV-JAS-009`, `EV-JAS-010`, `EV-JAS-008`, `EV-JAS-003`
- **Purpose:** brand guidance is reviewable both before and after it is applied.
- **Fields:** the voice preview and with/without comparison; an automatic style-guide setup that the documentation itself describes as an AI-recommended starting point rather than a guaranteed import, with an instruction to always review and refine; visual-guideline review feedback that either approves all images or gives a per-image reason; review of drafted product entries.
- **States:** recommended or draft versus reviewed and refined; approved versus flagged with a reason.
- **Actors:** all users may preview and apply; administrators and managers create and edit; a product owner verifies.
- **Relevance to 002:** the reference is candid that an AI-derived setup is a starting point requiring human refinement, and a rejection carries a per-item reason. Both map onto OMA's insight disposition model.
- **Unknowns:** no formal approve-or-reject workflow with sign-off is documented. Automatic brand-violation flagging appears only as a marketing claim and is therefore not evidence of a review gate.

### JAS-008 — Multiple brand profiles

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-JAS-004`, `EV-JAS-011`, `EV-JAS-009`, `EV-JAS-012`, `EV-JAS-008`, `EV-JAS-005`
- **Purpose:** several brand voices, audiences, style guides and visual guideline sets may coexist, with groups segmenting them by brand or region.
- **Fields:** the count of voices and audiences is plan-tiered, from a small fixed allowance up to unlimited; multiple style guides may exist per workspace, documented as suited to teams managing several brands or style systems; groups segment projects, knowledge, voices, visual guidelines and audiences; the product component is limited to one schema per workspace.
- **Controls:** only one style guide is active at a time; defaults exist at both workspace and project level; groups may be open or invite-only.
- **Relevance to 002:** multi-brand support is achieved by scoping components into groups rather than by duplicating a bundled profile — relevant to OMA's interim boundary of several brand workspaces under one tenant (`FR-BWI-002`), but it is a workspace-internal grouping, not a tenancy boundary, and must not be read as one.
- **Unknowns:** no per-brand bundling entity is documented.

### JAS-009 — Governance and permissions

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-JAS-013`, `EV-JAS-014`, `EV-JAS-015`, `EV-JAS-012`, `EV-JAS-016`, `EV-JAS-017`
- **Purpose:** role-based control over who may create, edit and delete brand components, plus an audit trail.
- **Fields:** four documented roles — an administrator with full control, a manager who administers knowledge and brand voice and may view and edit permission settings and usage data, a developer scoped to API access, and a member scoped to content creation; per-feature permission toggles covering groups, brand voice, audience, style guide, visual guidelines and knowledge base; an audit log that is plan-gated, administrator-only, retained for a bounded period and exportable; a private-to-user mode where content is private to its author and to administrators, with administrators able to view even private layers.
- **Controls:** a permission toggle set in workspace settings; turning a feature's toggle on restricts create, edit and delete to administrators and managers while leaving view and use open to everyone.
- **Relevance to 002:** the reference separates _who may use_ brand context from _who may change it_, and records changes in an audit trail — the same split as OMA's read versus edit versus decide versus approve capabilities.

### JAS-010 — Application of brand context and workspace defaults

- **Status:** `DOC_VERIFIED` · **Evidence:** `EV-JAS-004`, `EV-JAS-011`, `EV-JAS-010`, `EV-JAS-009`, `EV-JAS-018`
- **Purpose:** brand context is applied automatically across generation surfaces, with administrator-set workspace defaults that individual users may override.
- **Fields:** context is applied across the product's generation surfaces and its public API, including to string values inside structured responses; some surfaces automatically attach the most relevant context before generating; workspace-level defaults exist for voice, audience and visual guidelines and are administrator-only; style-guide defaults exist at both workspace and project level.
- **States:** default versus overridden; applied versus not applied.
- **Relevance to 002:** an automatically attached context is still disclosed and overridable, which supports OMA's rule that AI contribution is visible rather than silent.
- **Note on provider detail:** the documentation references a model-architecture page which was deliberately not opened. Only the existence of model disclosure is recorded; no provider or model name is carried into any OMA decision, consistent with `SR-002-007-AI` and the still-open `DEC-007`.
