# Screenshot manifest

| Set               | Count                                            | Path                                                           |
| ----------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| OMA before        | 85                                               | `artifacts/planable-oma-visual-differential/before/`           |
| OMA after W1      | 85                                               | `artifacts/planable-oma-visual-differential/after-w1/`         |
| Planable live     | 5 named frames plus one failed view-menu attempt | `artifacts/planable-oma-visual-differential/planable/`         |
| Interaction video | 0                                                | Motion duration was not measured. `UNKNOWN`.                   |
| W1 final closure  | 82 PNG, 12 sequences × 6 frames                  | `artifacts/planable-oma-visual-differential/w1-final-closure/` |

No `.webm` files. Playwright screenshot sequences are the motion evidence. ffmpeg was not installed. Raw files stay gitignored. The same tree is mirrored under `.reference/007-planable-oma-visual-differential/w1-final-closure/`.

Each OMA JSON sidecar has evidence id, route, viewport, locale, SHA, overflow, and `piiScrub: demo-fixtures-only`. Planable URLs in committed docs omit organization ids. Raw files stay gitignored.
