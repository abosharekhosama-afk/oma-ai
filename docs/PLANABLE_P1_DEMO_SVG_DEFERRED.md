# Demo SVG deferred mapping (not P1 token SoT)

`apps/web/public/demo/*` fixture images still contain DEC-013 violet (`#6658E8`) and dark fills (`#121419`, `#0f1117`). They are **media bytes**, not CSS tokens. P1 must not rewrite every asset.

They must not appear in P1 shell evidence (rail, header, search, create, dialog, drawer). They only appear inside later content/review surfaces when those pages render demo posters.

| File                     | Deferred to | Why                                                                     |
| ------------------------ | ----------- | ----------------------------------------------------------------------- |
| `poster-static.svg`      | P3          | Content calendar/grid cards                                             |
| `poster-carousel-1.svg`  | P3          | Content cards                                                           |
| `poster-carousel-2.svg`  | P3          | Content cards                                                           |
| `video-poster.svg`       | P3 / P5     | Content + review preview                                                |
| `stage5-static-v1.svg`   | P5          | Deliverable/review media                                                |
| `stage5-static-v2.svg`   | P5          | Deliverable/review media                                                |
| `stage5-carousel-v1.svg` | P5          | Deliverable/review media                                                |
| `stage5-carousel-v2.svg` | P5          | Deliverable/review media                                                |
| `stage5-carousel-v3.svg` | P5          | Deliverable/review media                                                |
| `stage5-video-v1.svg`    | P5          | Deliverable/review media                                                |
| `stage5-video-v2.svg`    | P5          | Deliverable/review media                                                |
| `stage5-doc-proof.svg`   | P5          | Mentions IBM Plex in SVG text — replace as OMA original copy/type in P5 |

**Not accepted** as Planable parity. Tracked here until the named stage replaces fixtures with original OMA media that uses Planable-adjacent neutrals, never Planable’s logo or assets.
