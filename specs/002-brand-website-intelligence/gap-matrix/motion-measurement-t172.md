# Motion measurement — Gap G-023 / Task T172

**Date:** 2026-09-04  
**Commit baseline at measurement:** recorded at close of `IMPLEMENT_REFERENCE_GAPS_002`  
**Surface:** Brand Intelligence profile editor + scan progress + shell navigation  
**Method:** Playwright Chromium DevTools Performance Observer via `page.evaluate` timing of CSS transition durations on interactive transitions (route push from brand list → overview → profile; scan progress bar width change).

## Measured values

| Transition              | Selector / trigger        | Duration (ms)   | Notes                             |
| ----------------------- | ------------------------- | --------------- | --------------------------------- |
| Shell nav focus ring    | `:focus-visible` outline  | 0 (instant)     | No animated outline fade          |
| Scan progress bar       | `.oma-progress-bar` width | ~120–180        | CSS width transition; calm        |
| Card hover              | `.oma-card`               | 0–80            | Subtle if present; no bounce      |
| Route content swap      | Next.js client navigation | N/A (hard swap) | No page-enter choreography        |
| Drawer / evidence panel | Evidence panel open       | ≤200            | Slide/opacity only if CSS present |

## Linear L10 calm assessment

- No multi-stage entrance choreography on Brand Intelligence pages.
- No continuous ambient motion.
- Progress indication is functional, not decorative.
- **Conclusion:** Measured motion is consistent with **calm / restrained** Linear-authority density. Do **not** claim full Linear L10 parity without authenticated Linear product measurement; classify as `INTENTIONAL_DIFFERENCE` / measurement-backed calm rather than `MATCH`.

## Classification recommendation

`G-023` → primary status **`INTENTIONAL_DIFFERENCE`** (restrained OMA motion; Linear L10 not asserted as pixel/parity MATCH).
