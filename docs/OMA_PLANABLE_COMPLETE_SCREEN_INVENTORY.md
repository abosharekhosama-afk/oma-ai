# OMA × Planable — Complete Screen Inventory (Forensic)

**Status:** LIVE forensic rebuild after Owner visual rejection  
**OMA baseline SHA (start):** `96753384d5f8bfd633a51faadeddf3c41b98639e`  
**Planable access:** `CDP_READY_AUTHENTICATED` via `127.0.0.1:9333`  
**Zoho Creator:** ignored (not a UI reference)

## Planable surfaces

| Surface                    | Evidence                                    | Level                              |
| -------------------------- | ------------------------------------------- | ---------------------------------- |
| Dashboard                  | `artifacts/.../planable/dashboard-1440.png` | LIVE_VERIFIED                      |
| Campaigns                  | `campaigns-1440.png`                        | LIVE_VERIFIED                      |
| View menu                  | `view-menu-1440.png` (when available)       | LIVE_VERIFIED / CONTROL_NOT_FOUND  |
| Calendar                   | attempted via view selector                 | LIVE_VERIFIED or CONTROL_NOT_FOUND |
| Shell 1024 / 390           | `shell-1024.png`, `shell-390.png`           | LIVE_VERIFIED                      |
| Notifications panel        | open/close only                             | LIVE_VERIFIED when control present |
| Feed / List / Saved column | not found as distinct controls in session   | CONTROL_NOT_FOUND                  |
| Composer                   | not opened (would risk draft)               | REFERENCE_UNAVAILABLE              |
| Settings mutation          | not opened                                  | SANDBOX_DATA_REQUIRED              |
| Grid PRO label             | plan gated                                  | PLAN_GATED                         |

## OMA surfaces captured after R1

| Surface                                   | Evidence                            | Notes                       |
| ----------------------------------------- | ----------------------------------- | --------------------------- |
| Command Center                            | `oma-after/command-center-1440.png` |                             |
| Campaigns                                 | `oma-after/campaigns-1440.png`      |                             |
| Content Calendar/Grid/List/Feed           | `content-*-1440.png`                | Grid cards ~403px after fix |
| Requests / Tasks / Deliverables / Reviews | captured                            |                             |
| Schedule / Settings                       | captured                            |                             |
| Content Grid 390                          | `content-grid-390.png`              | no page overflow            |

## Prior live comparison documents

Preserved at `/tmp/oma-planable-prior-live-comparison.patch`.  
Their claim `High/Medium = 0` is **SUPERSEDED** by rendered Owner evidence and this forensic pass (clipped Ant Button surfaces, broken SVGs, `next dev` overlay).
