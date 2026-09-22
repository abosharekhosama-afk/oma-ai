# Planable component delta matrix (owner rejection rebuild)

**Stage:** `IMPLEMENT_OMA_PLANABLE_COMPONENT_PARITY_AND_PRODUCT_CLARITY_REBUILD`  
**Live session:** `CDP_READY_AUTHENTICATED` · profile `OMA-References-Chrome` · CDP `127.0.0.1:9333`  
**Probe:** `artifacts/planable-component-parity-004/component-probe.json`  
**Starting SHA:** `20849acf64ecbca60462333af57df69054c5339c`

## Binding rejection (do not treat P7 as visual pass)

See `docs/OWNER_REJECTION_PLANABLE_COMPONENT_AUDIT.md`.

## Live measurements (2026-09-22)

| Element                  | Planable LIVE                                                    | OMA before                       | Required fix                                                        | Confidence                  |
| ------------------------ | ---------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------- | --------------------------- |
| Body canvas              | `#F5F6F7` / `rgb(245,246,247)`                                   | matched                          | keep                                                                | LIVE                        |
| Body ink                 | `#333` / `rgb(51,51,51)`                                         | matched                          | keep                                                                | LIVE                        |
| Body type                | system UI · 14px                                                 | matched                          | keep                                                                | LIVE                        |
| Rail search input height | **30px** · radius **6px** · pad-x **11px** · transition **0.3s** | 32px controls / weaker hover     | Compact search 30px; stronger hover/focus/error                     | LIVE                        |
| Overlay transition       | opacity ~0.2–0.3s                                                | partial                          | Dialog/drawer use 300ms + scrim token                               | LIVE (dialog role observed) |
| Dialog chrome            | professional header/body/footer + close                          | flat padded box                  | Structured `oma-dialog-header/body/footer`, 8px radius, elev-dialog | LIVE + ARCHIVED compose     |
| Drawer                   | panel with shadow / mobile full                                  | flat, weak elev                  | 400px width, elev-dialog, structured slots                          | LIVE-aligned + ARCHIVED     |
| Primary button           | 32px · `#1677FF` · radius 6                                      | present but weak active/disabled | active + disabled opacity 0.45                                      | ARCHIVED + token LIVE       |
| Form focus               | border primary + glow                                            | outline-only                     | border + 2px glow; hover border-strong; error danger                | LIVE input + OMA_ADAPTATION |
| Motion                   | 150ms rail / 300ms control                                       | tokens present                   | applied to inputs/overlays/buttons                                  | LIVE tokens                 |

## Closure checklist

| Gap                                                | Status                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Dialog structure                                   | FIXED in shared Dialog + CSS                                                                                              |
| Input/select/textarea states                       | FIXED in primitives                                                                                                       |
| Drawer elevation/width                             | FIXED in tokens/primitives                                                                                                |
| Journey clarity                                    | FIXED Command Center checklist + strip + honesty                                                                          |
| AI/integration honesty                             | FIXED ConnectionHonestyPanel                                                                                              |
| Duplicate primitives inventory                     | Script `scripts/ui/inventory-visual-primitives.mjs`                                                                       |
| Full surface migration of every page-local control | **CLOSED** by `RESUME_AND_COMPLETE_OMA_PLANABLE_FINAL_STYLE_CONVERGENCE` — see `docs/PLANABLE_FINAL_STYLE_CONVERGENCE.md` |

## Evidence paths

- Screenshots: `artifacts/planable-component-parity-004/screenshots/`
- Mirror: `.reference/005-planable-ui-ux/ours/component-parity-rebuild/`
