# Full Visual Certification Matrix — Feature 004

**Branch:** `004-oma-complete-product-demo`  
**Starting SHA:** `9c280437ffa32e06cc4a51c8171e34101c49f391`  
**Status:** PASS when linked to journey + evidence + gates (not route-only)

| Surface | Route | Source | Reference pattern | EN 1440 | AR 1440 | Tablet | Mobile | Keyboard | Semantic | Interaction | Persistence | Restricted | Empty/Error | Screenshot | Automated test | Status | Limitation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Login | `/login` | Production-shaped | Linear auth density | Y | Y | Y | Y | Y | form labels | sign-in | session cookie | n/a | validation | 01-login | auth-session + cert evidence | PASS | — |
| Command Center | `/app` | Hybrid | Linear home | Y | Y | Y | Y | Y | H1 + landmarks | next actions | demo graph | demo off 403 | empty brands | 02-command-center | stage2 + full-cert | PASS | Demo modules not production-complete |
| Brand portfolio | `/app/brands` | Production-shaped | Semrush/Linear | Y | Y | Y | Y | Y | table | open brand | Foundation | capability | empty | 03-brand-intelligence | stage2 + brand-* | PASS | — |
| Strategy / campaign link | `/app/campaigns/[id]` | Demo-backed | Jasper + Planable | Y | Y | Y | Y | Y | strategy id | Organic/Paid | demo | demo off | — | 04-strategy-organic-paid | stage3 + full-cert | PASS | Strategy create is Foundation; demo strategy via campaign |
| Campaigns | `/app/campaigns` | Demo-backed | Planable | Y | Y | Y | Y | Y | filters | open detail | demo | demo off | empty | 05-campaign-portfolio | stage3 | PASS | — |
| Content calendar | `/app/content` | Demo-backed | Planable | Y | Y | Y | Y | Y | views | calendar/list/grid | demo | demo off | empty | 06-content-calendar | stage3 | PASS | Publishing not connected |
| Requests / Brief | `/app/requests/*` | Demo-backed | Workfront | Y | Y | Y | Y | Y | brief sections | edit/convert | demo API | demo off | incomplete | 07-requests-brief | stage4 | PASS | AI assist deferred |
| Tasks Kanban | `/app/tasks` | Demo-backed | Linear | Y | Y | Y | Y | Y | board | accessible move | demo API | demo off | empty | 08-tasks-kanban | stage4 | PASS | No fake DnD |
| Task drawer | `/app/tasks?task=` | Demo-backed | Linear | Y | Y | Y | Y | Esc/trap | drawer | checklist/comments | demo | demo off | — | 09-task-detail | stage4 | PASS | — |
| Deliverables | `/app/deliverables` | Demo-backed | Planable | Y | Y | Y | Y | Y | groups | open detail | demo | demo off | empty | 10-deliverables | stage5 | PASS | Local demo assets |
| Dark review | `/app/deliverables/[id]?review=1` | Demo-backed | Frame.io DOC | Y | Y | Y | Y | canvas alt | review landmarks | annotate/decide | demo API | demo off | — | 11/12-review | stage5 + full-cert | PASS | Scoped dark canvas only |
| Schedule | `/app/schedule` | Demo-backed | Planable DOC | Y | Y | Y | Y | dialog | readiness | reschedule | demo API | demo off | blocked | 13-schedule | stage6 + full-cert | PASS | Planning preview only |
| Analytics | `/app/analytics` | Demo-backed | Smartly DOC | Y | Y | Y | Y | SR table | KPIs | filters/drill | deterministic | demo off | zero-data | 14-analytics | stage6 | PASS | Sample data; not live |
| Team | `/app/team` | Hybrid | Workfront/Linear | Y | Y | Y | Y | Y | table | drawer | demo workload + Foundation link | restricted badge | empty | 15-team-workload | stage6 | PASS | No parallel membership SoT |
| Activity | `/app/activity` | Hybrid | Workfront ops | Y | Y | Y | Y | Y | source labels | deep links | demo + audited | — | empty | 16-activity | stage6 | PASS | Demo ≠ Audit Log |
| Settings / Integrations | `/app/settings` | Demo-backed | Linear IA | Y | Y | Y | Y | Y | sections | prefs save | demo prefs | — | — | 17-settings-integrations | stage6 + full-cert | PASS | No Connect/API keys |
| Company members | `/app/company/members` | Production-shaped | Linear | Y | Y | Y | Y | Y | list | invite | Foundation | denied | empty | (company e2e) | company-invitation* | PASS | — |
| Shell chrome | `*` | Production-shaped | Linear | Y | Y | Y | Y | nav/search | landmarks | collapse | prefs | — | — | 18–20 viewports | shell-stage1 | PASS | — |

## Source summary

| Type | Surfaces |
| --- | --- |
| Production-shaped | Login, Shell, Brand Intelligence, Company Members, Foundation capabilities |
| Demo-backed | Campaigns→Analytics planning/production modules |
| Hybrid | Command Center, Team, Activity |

## Intentional limitations

- External AI / crawl / publishing / ads / analytics / storage / email-push: **DEFERRED**
- Demo modules: **NOT_PRODUCTION_COMPLETE**
- Visual/User Acceptance: **PENDING_OWNER / PENDING** (owner decides)
