# Pixel Parity — Overlay Matrix

Coverage target: 100%. Capture closed/open/focus/validation/scroll/close/mobile/RTL where applicable.

| Overlay                  | Surface             | States captured                 | Verdict                       |
| ------------------------ | ------------------- | ------------------------------- | ----------------------------- |
| Filter sheet             | Content / Campaigns | OPEN (before)                   | NOT_PASS                      |
| Create content dialog    | Content             | OPEN (before)                   | NOT_PASS                      |
| Composer / detail drawer | Content             | PENDING                         | NOT_PASS                      |
| View dropdown            | Planable Content    | OPEN on reference calendar shot | LIVE_VERIFIED (Planable only) |
| Unsaved changes dialog   | Content             | PENDING                         | NOT_PASS                      |

Propagation overlays (tasks drawer, review dialogs, etc.) are **BLOCKED_BY_GOLDEN**.
