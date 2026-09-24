# Interaction differential

| Interaction            | Planable                       | OMA before                  | After W1                            |
| ---------------------- | ------------------------------ | --------------------------- | ----------------------------------- |
| View switch            | LIVE calendar only             | Four buttons exist          | Same four buttons, preference local |
| Saved column           | LIVE empty state copy          | Missing                     | Undated items listed                |
| Set date               | Help: save can keep a draft    | Save wrote `scheduledAt`    | `save-draft` keeps `UNSCHEDULED`    |
| Schedule               | Help: separate command         | Status dropdown             | Explicit Schedule / Unschedule      |
| Approval policy        | Help: None, Optional, Required | Missing                     | Select on the content toolbar       |
| Dialog / drawer motion | UNKNOWN                        | UNKNOWN                     | UNKNOWN                             |
| Drag between dates     | LIVE not exercised             | Not persisted               | Not added. No fake drag.            |
| Reduced motion         | UNKNOWN                        | Existing CSS not remeasured | UNKNOWN                             |

Escape, click-outside, and focus restoration were not timed in this pass.

## W1 final closure sequences

Twelve Playwright screenshot sequences, six frames each, under `artifacts/planable-oma-visual-differential/w1-final-closure/oma/motion/`. ffmpeg was not installed. Each `meta.json` records start, end, duration, and the Escape / outside / reduced-motion notes for that pass.

| Sequence                         | Duration |
| -------------------------------- | -------- |
| View switch                      | 887ms    |
| Approval filter                  | 256ms    |
| Card hover/focus                 | 307ms    |
| Saved open                       | 458ms    |
| Composer open/close              | 292ms    |
| Date change stays draft          | 517ms    |
| Partial approval blocks Schedule | 395ms    |
| Explicit Schedule                | 549ms    |
| Unschedule                       | 304ms    |
| Schedule Calendar/Agenda/Queue   | 316ms    |
| Mobile                           | 755ms    |
| Keyboard                         | 542ms    |
