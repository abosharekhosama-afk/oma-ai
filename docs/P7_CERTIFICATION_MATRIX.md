# Planable full UI/UX certification matrix (P7)

**Stage:** `CERTIFY_OMA_PLANABLE_FULL_UI_UX_EXPERIENCE`  
**Decision:** DEC-017  
**Starting SHA:** `2dbd64a863f2d1b4e71b863e57da3e188f3d963f`  
**Live Planable:** `CDP_READY_AUTHENTICATED` · LIVE_VERIFIED shell/campaigns/calendar/responsive

| Surface                             | Backing                  | Ref level         | Visual | Interaction | Responsive | RTL  | A11y | Honesty                  | Test proof                              | Limitation                    |
| ----------------------------------- | ------------------------ | ----------------- | ------ | ----------- | ---------- | ---- | ---- | ------------------------ | --------------------------------------- | ----------------------------- |
| Login                               | Production-shaped        | ARCHIVED+OMA      | PASS   | PASS        | PASS       | PASS | PASS | n/a                      | e2e cert evidence                       | —                             |
| Command Center                      | Hybrid                   | OMA_ADAPTATION    | PASS   | PASS        | PASS       | PASS | PASS | Demo disclosure          | full-visual-certification + P7 evidence | —                             |
| Brand portfolio / Intelligence      | Production-shaped        | OMA_ADAPTATION    | PASS   | PASS        | PASS       | PASS | PASS | Fixture crawl honesty    | brand e2e / cert                        | Crawl vendor deferred         |
| Strategy                            | Hybrid                   | OMA_ADAPTATION    | PASS   | PASS        | PASS       | PASS | PASS | AI honesty               | strategy tests                          | AI vendor deferred            |
| Campaigns                           | Demo-backed              | LIVE_VERIFIED+OMA | PASS   | PASS        | PASS       | PASS | PASS | Sample                   | stage3 + cert                           | —                             |
| Content Calendar/Grid/List/Composer | Demo-backed              | LIVE+PLAN_GATED   | PASS   | PASS        | PASS       | PASS | PASS | No fake publish          | stage3 e2e                              | Planable feed/grid plan-gated |
| Requests / Brief                    | Demo-backed              | OMA_ADAPTATION    | PASS   | PASS        | PASS       | PASS | PASS | —                        | stage4 e2e                              | —                             |
| Tasks Kanban / Drawer               | Demo-backed              | OMA_ADAPTATION    | PASS   | PASS        | PASS       | PASS | PASS | Local reorder honesty    | stage4 + cert                           | —                             |
| Deliverables / Reviews / Versions   | Demo-backed              | OMA_ADAPTATION    | PASS   | PASS        | PASS       | PASS | PASS | Immutability             | stage5 e2e                              | —                             |
| Schedule                            | Demo-backed              | OMA_ADAPTATION    | PASS   | PASS        | PASS       | PASS | PASS | Publishing not connected | stage5/6 e2e                            | External publish deferred     |
| Analytics                           | Demo-backed              | OMA_ADAPTATION    | PASS   | PASS        | PASS       | PASS | PASS | Sample / not connected   | stage6 + P6                             | External analytics deferred   |
| Team / Activity                     | Demo / Foundation hybrid | OMA_ADAPTATION    | PASS   | PASS        | PASS       | PASS | PASS | Source labels            | P6 e2e                                  | —                             |
| Notifications                       | Production-shaped        | OMA_ADAPTATION    | PASS   | PASS        | PASS       | PASS | PASS | In-app only              | P6 e2e                                  | Email/push deferred           |
| Settings / Integrations             | Demo-backed              | SANDBOX_REF       | PASS   | PASS        | PASS       | PASS | PASS | No Connect/OAuth         | P6 e2e                                  | Integrations deferred         |
| Company Members                     | Production-shaped        | DOC+OMA           | PASS   | PASS        | PASS       | PASS | PASS | Foundation SoT           | company e2e                             | —                             |

**Aggregate visual/interaction certification:** PASS (implementation + evidence).  
**Owner visual acceptance:** PENDING_OWNER (not claimed).
