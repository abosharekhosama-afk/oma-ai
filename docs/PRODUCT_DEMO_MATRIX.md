# OMA Complete Product Demo — Implementation Matrix

**Branch:** `004-oma-complete-product-demo`  
**Base:** Feature 003 certified SHA `98af553`  
**Authority:** Foundation US-001–US-009 + DEC-013 + DEC-016

| Area                                                       | Classification                           | Backing                                  |
| ---------------------------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| Auth / tenant / capabilities / audit / outbox              | Production-shaped                        | Features 001                             |
| Brand Intelligence (profile/scan/discovery/evidence)       | Production-shaped                        | Feature 002                              |
| Strategy (foundation/organic/paid/review/versions/current) | Production-shaped                        | Feature 003                              |
| Command Center (portfolio + needs action)                  | Existing, visually incomplete → expanded | Real brands/strategies + demo aggregator |
| Campaigns                                                  | Planned but not visible → demo           | `DemoDataProvider`                       |
| Content Planning (calendar/grid/list)                      | Planned → demo                           | `DemoDataProvider`                       |
| Requests / Briefs                                          | Planned → demo                           | `DemoDataProvider`                       |
| Tasks / Production Kanban                                  | Planned → demo                           | `DemoDataProvider`                       |
| Creative Deliverables + versions                           | Planned → demo                           | `DemoDataProvider` + local assets        |
| Review inbox / approvals                                   | Partial (brand/strategy) → expanded demo | Demo + links to real review routes       |
| Scheduling / Publishing preview                            | Planned → demo (simulated only)          | `DemoDataProvider`                       |
| Analytics / Reports                                        | Planned → demo charts                    | `DemoDataProvider`                       |
| Team / Workload                                            | Partial (members) → expanded             | Real members + demo workload             |
| Notifications / Activity                                   | Partial → expanded seed events           | Real notifications + demo timeline       |
| Settings / Integrations catalog                            | Planned → demo honesty                   | Static catalog, all Not Connected        |
| Live AI / crawl / ads / publish / analytics / storage      | Deferred external                        | Refusing ports; no SDKs                  |

**Guard:** `OMA_DEMO_MODE=1` only when `NODE_ENV` is `development` or `test`. Hard-disabled in production.
