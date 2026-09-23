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
