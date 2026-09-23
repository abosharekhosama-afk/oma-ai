# Planable to OMA customer journey

**Access date:** 2026-09-23.  
Current OMA is the product on branch `004-oma-complete-product-demo`. Target experience uses Planable workflow language without copying Planable's brand.

| Step | User goal                    | Current OMA                     | Target experience                                        | AI role                 | Manual fallback                  | Data source  |
| ---- | ---------------------------- | ------------------------------- | -------------------------------------------------------- | ----------------------- | -------------------------------- | ------------ |
| 1    | Sign in                      | OMA login and company select    | Unchanged OMA auth                                       | None                    | Credentials                      | OMA          |
| 2    | Create a company / workspace | Onboarding and company          | Choose approval workflow before work starts              | None                    | Pick None, Optional, or Required | OMA policy   |
| 3    | Create a brand               | Brand portfolio                 | Brand is the Planable-like workspace content home        | None                    | Form                             | OMA          |
| 4    | Brand Intelligence           | Scans, profiles, evidence       | OMA domain, Planable chrome                              | Proposal only, paused   | Type the profile                 | OMA evidence |
| 5    | Strategy                     | Organic and paid strategy pages | OMA domain, Planable chrome                              | Proposal only, paused   | Edit strategy fields             | OMA          |
| 6    | Campaign                     | Campaign portfolio              | Campaign groups content items                            | Brief draft paused      | Name and dates by hand           | OMA          |
| 7    | Content                      | Content route                   | Feed, Calendar, List, Grid; Saved column                 | Caption proposal paused | Write the post                   | OMA          |
| 8    | Request / brief / task       | Separate OMA queues             | Stay OMA objects; content is the Planable post           | None on the queues      | Create records by hand           | OMA          |
| 9    | Deliverable                  | Deliverable detail              | Feedback and approval on the content item                | Review summary paused   | Comment by hand                  | OMA          |
| 10   | Review                       | Reviews queue                   | Filters: not approved, partial, pending me, approved     | None                    | Open each item                   | OMA          |
| 11   | Schedule                     | Schedule calendar               | Set date, then Schedule, then publish result             | None                    | Set each command                 | OMA          |
| 12   | Analytics                    | Analytics page                  | OMA operational analytics now; social metrics later      | Interpretation paused   | Read the figures                 | OMA          |
| 13   | Team and settings            | Team, members, settings         | Invite first, assign approvers second; approval settings | None                    | Admin forms                      | OMA          |
| 14   | Integrations                 | Catalog only                    | Deferred                                                 | None                    | Do not connect                   | None         |

## What is what today

- **Production-shaped:** login, company boundary, brands, strategy records, campaigns, tasks, deliverables, reviews, schedule records, team, settings. They persist in OMA. They do not match the Planable workflow yet.
- **Demo:** social publishing, failed-publish reasons, and social analytics. No external publisher is connected.
- **Waiting on external integrations:** pages/channels, real publish, inbox, and competitor analytics. `DEC-016` stays deferred.
- **AI:** placement is documented. Live access is not verified. The product must stay usable with AI disabled.
