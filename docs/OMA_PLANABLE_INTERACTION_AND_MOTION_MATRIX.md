# OMA × Planable — Interaction and Motion Matrix

| Interaction                         | Planable                   | OMA                               | Verdict                       |
| ----------------------------------- | -------------------------- | --------------------------------- | ----------------------------- |
| View switcher                       | LIVE menu / Grid PRO gated | Segmented Calendar/Feed/Grid/List | OMA_ADAPTATION                |
| Filter bar                          | LIVE 32px controls         | Ant + OmaSelect 32px              | CLOSE                         |
| Content card open → drawer          | Planable post details      | Ant Drawer wide                   | CLOSE after R1 (no 32px clip) |
| Notifications open/close            | LIVE                       | Shell notifications               | CLOSE                         |
| Kanban drag                         | n/a (Planable)             | `@dnd-kit` preserved              | OMA_ADAPTATION                |
| Dialog create content               | not mutated on Planable    | Ant Modal                         | CLOSE                         |
| prefers-reduced-motion              | honor                      | theme motion tokens               | CLOSE                         |
| Next.js Fast Refresh / Issues badge | n/a                        | forbidden on acceptance           | fixed by production launcher  |

Motion durations remain Ant theme mid `0.15s` / slow `0.3s` unless Planable live measure requires change in R2.
