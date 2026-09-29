# OMA × Planable — Component Measurements

Measured live unless marked otherwise.

## Planable (LIVE_VERIFIED sample)

Source: CDP `127.0.0.1:9333` · `artifacts/oma-planable-forensic-parity/planable/measures.json`

| Token     | Planable                                           |
| --------- | -------------------------------------------------- |
| Body font | system UI stack                                    |
| Font size | 14px                                               |
| Ink       | `rgb(51, 51, 51)`                                  |
| Canvas    | `rgb(245, 246, 247)`                               |
| Sidebar   | ~256px white rail (when `.layout-sidebar` present) |

## OMA after R1 (LIVE on preview)

| Token                    | OMA                                 |
| ------------------------ | ----------------------------------- |
| Theme primary            | `#1677FF` (`packages/ui` Ant theme) |
| Control height           | 32px (form controls only)           |
| Content grid card height | ~403px (SurfaceButton)              |
| Content list row height  | ~49–61px                            |
| Border radius control    | 6px                                 |
| Broken demo images       | 0 after SVG rewrite                 |

## Classification

| Pattern                      | Verdict                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| Form Button / Input / Select | CLOSE to Planable density via Ant theme                           |
| Content post surfaces        | OMA_ADAPTATION using `SurfaceButton` (must not use controlHeight) |
| Demo media                   | MATCH integrity after fix (original OMA assets, not Planable art) |
