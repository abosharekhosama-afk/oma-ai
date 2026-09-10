# OMA Complete Product Demo — Implementation Matrix

**Branch:** `004-oma-complete-product-demo`  
**Base:** Feature 003 certified SHA `98af553`  
**Authority:** Foundation US-001–US-009 + DEC-013 + DEC-016

| Area                                                       | Classification                         | Backing                                                                              |
| ---------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| Auth / tenant / capabilities / audit / outbox              | Production-shaped                      | Feature 001                                                                          |
| Brand Intelligence (profile/scan/discovery/evidence)       | Production-shaped                      | Feature 002                                                                          |
| Strategy (foundation/organic/paid/review/versions/current) | Production-shaped                      | Feature 003                                                                          |
| Command Center (portfolio + needs action)                  | Hybrid                                 | Real brands/notifications + demo aggregator when `OMA_DEMO_MODE=1`                   |
| Campaigns                                                  | Demo-adapter (not production-complete) | `DemoDataProvider`                                                                   |
| Content Planning (calendar/grid/list)                      | Demo-adapter (not production-complete) | `DemoDataProvider`                                                                   |
| Requests / Briefs                                          | Demo-adapter (not production-complete) | `DemoDataProvider`                                                                   |
| Tasks / Production Kanban                                  | Demo-adapter (not production-complete) | `DemoDataProvider`                                                                   |
| Creative Deliverables + versions                           | Demo-adapter (not production-complete) | `DemoDataProvider` + local SVG assets                                                |
| Review inbox / approvals                                   | Hybrid                                 | Demo deliverable review (local UI only) + links to real Brand/Strategy review routes |
| Scheduling / Publishing preview                            | Demo-adapter (simulated only)          | `DemoDataProvider`                                                                   |
| Analytics / Reports                                        | Demo-adapter (demo charts only)        | `DemoDataProvider`                                                                   |
| Team / Workload                                            | Demo-adapter + link-out                | Demo members/workload via `DemoDataProvider`; real invites at Company members        |
| Notifications / Activity                                   | Hybrid                                 | Real notification bell on shell; Activity timeline is demo-seeded                    |
| Settings / Integrations catalog                            | Demo honesty                           | Static catalog — all Not Connected / Deferred                                        |
| Live AI / crawl / ads / publish / analytics / storage      | Deferred external                      | Refusing ports; no SDKs                                                              |

**Guard:** `OMA_DEMO_MODE=1` only when `NODE_ENV` is `development` or `test`. Hard-disabled in production (`loadEnv` throws; `isDemoModeEnabled` returns false).

**Honesty:** Demo approve/reject actions update local UI only and do not persist. Demo modules are **not** production-complete.
