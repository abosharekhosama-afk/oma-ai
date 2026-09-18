# P7 Gap Ledger — Planable full UI/UX certification

**Stage:** `CERTIFY_OMA_PLANABLE_FULL_UI_UX_EXPERIENCE`  
**Decision:** DEC-017  
**Live session:** `CDP_READY_AUTHENTICATED` (OMA References profile · `127.0.0.1:9333`)  
**Candidate SHA (start):** `2dbd64a863f2d1b4e71b863e57da3e188f3d963f`

## Live Planable coverage (this session)

| Surface                   | Level                       | Notes                                      |
| ------------------------- | --------------------------- | ------------------------------------------ |
| Dashboard / shell desktop | LIVE_VERIFIED               | Approvals shell + dashboard                |
| Campaigns all             | LIVE_VERIFIED               | Opened existing Sample workspace           |
| Calendar                  | LIVE_VERIFIED               | Workspace calendar                         |
| Shell 1024 / 390          | LIVE_VERIFIED               | Responsive matrix                          |
| View switcher             | LIVE_VERIFIED (interaction) | Opened; Escape; no mutation                |
| Feed / Grid / List        | PLAN_GATED / NOT_AVAILABLE  | Menu items not present or gated            |
| Settings                  | SANDBOX_DATA_REQUIRED       | No safe settings link in session           |
| Composer                  | NOT_AVAILABLE               | Create control not found without mutation  |
| Arabic RTL in Planable    | NOT_IN_SESSION              | OMA AR proven separately                   |
| Reduced motion (Planable) | NOT_OBSERVED                | OMA reduced-motion proven in product tests |

## Closed gaps in P7

| ID      | Gap                                       | Resolution                                                                                      |
| ------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| G-P7-01 | `owner-surface-depth` Quiet craft failure | Superseded under DEC-017 — assert Planable poster (`Back-to-work layers`, `#F5F6F7`, `#1677FF`) |
| G-P7-02 | Campaign portfolio default assert drift   | Updated to `useState<CampaignLayout>('portfolio')`                                              |
| G-P7-03 | Live measure missed workspace             | Open existing workspace card (never Create)                                                     |

## Remaining honest limitations (not defects)

| ID      | Item                                                   | Disposition                                                   |
| ------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| L-P7-01 | External integrations                                  | DEFERRED                                                      |
| L-P7-02 | Demo modules ≠ production backends                     | Documented                                                    |
| L-P7-03 | Owner visual acceptance                                | PENDING_OWNER / REJECTED until owner decides                  |
| L-P7-04 | Planable Feed/Grid/List/Settings/Composer in this plan | PLAN_GATED / SANDBOX / NOT_AVAILABLE — OMA adaptations remain |

## Visual audit axes (OMA vs LIVE + baseline)

Tokens match LIVE summary: system UI stack, 14px body, canvas `#F5F6F7`, ink `#333`, primary `#1677FF`, radius 6px, control ~32px.  
No runtime legacy aliases (P6 inventory). No giant-card / purple contamination found in P1–P6 surfaces during certification re-verify.
