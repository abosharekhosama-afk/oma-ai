# Planable live A2 final comparison

> **SUPERSEDED by Owner rendered evidence and forensic rebuild.**  
> See `docs/OMA_PLANABLE_FORENSIC_VISUAL_GAP_LEDGER.md`. The earlier High/Medium = 0 visual PASS is invalid for Owner acceptance.

**Date:** 2026-09-27  
**OMA SHA:** `96753384d5f8bfd633a51faadeddf3c41b98639e`  
**Planable access:** `CDP_READY_AUTHENTICATED` on `https://app.planable.io/` via the dedicated `OMA-References-Chrome` profile at `127.0.0.1:9333`  
**Mutations:** none. Existing Sample workspace was opened. Compose, New story, Upgrade, favorite, share, and create-workspace were not used.

## What was live

| Surface                               | Status                                                          |
| ------------------------------------- | --------------------------------------------------------------- |
| Dashboard                             | `LIVE_VERIFIED`                                                 |
| Workspace shell / sidebar 256px       | `LIVE_VERIFIED`                                                 |
| Content grid (open view, labeled PRO) | `LIVE_VERIFIED`                                                 |
| Calendar                              | `LIVE_VERIFIED`                                                 |
| Campaigns list                        | `LIVE_VERIFIED`                                                 |
| Filter control                        | `LIVE_VERIFIED`                                                 |
| Search focus                          | `LIVE_VERIFIED`                                                 |
| Notifications panel                   | `LIVE_VERIFIED`                                                 |
| 1024 and 390 shell                    | `LIVE_VERIFIED` (mobile overflow 0)                             |
| Feed, List, Saved column              | `CONTROL_NOT_FOUND` this pass                                   |
| Grid/List plan badges                 | `PLAN_GATED` (Grid shows PRO)                                   |
| Composer                              | `REFERENCE_UNAVAILABLE` (not opened, to avoid creating a draft) |
| Settings forms                        | `SANDBOX_DATA_REQUIRED` (not opened)                            |

## Measured tokens

| Token                         | Planable live                       | OMA on 3010                  | Verdict        |
| ----------------------------- | ----------------------------------- | ---------------------------- | -------------- |
| Body font                     | system UI, 14px / 400 / ~21.5px     | system UI, 14px              | MATCH          |
| Ink                           | `rgb(51, 51, 51)`                   | `rgb(51, 51, 51)`            | MATCH          |
| Canvas                        | `rgb(245, 246, 247)`                | `rgb(245, 246, 247)`         | MATCH          |
| Rail surface                  | white, 256×900                      | white, 256×900               | MATCH          |
| Filter / view height          | 32px                                | control height 32px          | MATCH          |
| Filter / view radius          | 6px                                 | 6px                          | MATCH          |
| Primary compose fill          | `rgb(22, 119, 255)`                 | theme `#1677FF`              | MATCH          |
| Compose radius                | 8px                                 | control radius 6px           | CLOSE          |
| Header search height          | 30px                                | input 32px                   | CLOSE          |
| Control motion                | `0.3s cubic-bezier(0.4, 0, 0.2, 1)` | 150ms micro / 300ms controls | CLOSE          |
| Search focus ring             | none on the borderless field        | shared focus token           | OMA_ADAPTATION |
| Post grid / campaigns content | Planable posts                      | OMA planning data            | OMA_ADAPTATION |

## Gap totals

- High: 0
- Medium: 0
- Low: 3 (compose radius 8 vs 6, compact search 30 vs 32, focus treatment)
- Critical interaction gaps: 0

No product code was changed. The 6px control radius stays, because the live filter and view switcher are 6px and that is the certified control metric. The 8px value is the large Compose button only.
