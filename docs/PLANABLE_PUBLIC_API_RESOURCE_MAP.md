# Planable public API resource map

**Access date:** 2026-09-23.  
Reference only. This stage does not add a Planable client, token, or integration.  
Interactive docs `EV-API-DOCS` were not fetched. Operations below are the ones named in official help, the product guide, or the changelog.

| Resource             | Announced operations                                                   | Public semantics                           | Proposed OMA mapping                                                                | Cannot infer      |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- | ----------------- |
| Workspaces           | List, create, delete                                                   | Client/brand space                         | OMA company or brand container is an `OMA_ADAPTATION`; do not copy Planable tenancy | Tables, isolation |
| Pages                | List, analytics, metrics sync                                          | Connected social pages                     | OMA channels stay deferred under DEC-016                                            | OAuth internals   |
| Posts                | List, create, update unpublished, delete, reorder, analytics, comments | API creates drafts; approval still applies | OMA content item                                                                    | Publisher queue   |
| Media                | List, upload from URL                                                  | Library assets                             | OMA media later                                                                     | Storage vendor    |
| Labels               | List, create                                                           | Campaign or pillar tags                    | OMA labels on content                                                               | Color storage     |
| Stories              | Create Instagram stories                                               | Separate from feed posts                   | Not an OMA v1 surface                                                               | Delivery          |
| Campaigns            | Create, view, edit, delete; add or remove posts                        | API v2                                     | OMA campaigns                                                                       | Schema            |
| Custom views         | Create, view, edit, delete                                             | Saved filters                              | OMA saved views                                                                     | Query engine      |
| Comments             | Manage on posts                                                        | Collaboration                              | OMA review comments                                                                 | Thread storage    |
| Competitor analytics | Add/remove, compare, trends, top posts                                 | Analytics add-on                           | Not in OMA scope                                                                    | Vendor data       |

Base URL stated officially: `https://api.planable.io/api/v1`. Tokens are described as starting with `pln_`. Availability: Public API on Pro and Enterprise (`EV-CHG-V2`). `PLAN_GATED`.

Nothing in these sources authorizes a Planable database design, internal services, or queues.
