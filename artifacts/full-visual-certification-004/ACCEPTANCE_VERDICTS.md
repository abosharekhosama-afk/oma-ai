# Acceptance criteria convergence — Full Visual Certification

**Branch:** `004-oma-complete-product-demo`  
**Verdict rule:** each ID needs code + interaction + automated test + screenshot (or explicit limitation). Owner alone may set ACCEPTED.

| ID | Code | Interaction | Test | Screenshot | Limitation | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| V-G-01…08 | tokens/shell | Stage1–6 surfaces | shell + stages | 02/18 | — | PASS |
| V-SHELL-01…08 | AppShell | collapse/RTL/mobile | shell-stage1 | 18–20 | — | PASS |
| V-HOME-01/02 | `/app` | CC hierarchy | stage2 + full-cert | 02 | Hybrid demo | PASS |
| V-BWI-01 | brands table | portfolio | stage2 | 03 | — | PASS |
| V-STR-01 | strategy/campaign | Organic/Paid | stage2/3 + full-cert | 04 | Demo strategy via campaign | PASS |
| V-CMP-01/02 (V-CAM) | campaigns | filters/workspace | stage3 | 05/04 | Demo-backed | PASS |
| V-CNT-01…03 (V-CONT) | content | calendar/list/grid | stage3 | 06 | Publishing deferred | PASS |
| V-LINK-01…04 | deep links | journey | stage3–6 + full-cert | 04–17 | — | PASS |
| V-REQ-01/02 | requests | inbox/detail | stage4 | 07 | — | PASS |
| V-BRF-01 | brief | structured | stage4 | 07 | AI deferred | PASS |
| V-TSK-01…03 | tasks | board/drawer | stage4 | 08/09 | No fake DnD | PASS |
| V-WRK-01/02 | handoffs | convert/review | stage4/5 + full-cert | 07–12 | Demo API | PASS |
| V-DEL-01 | deliverables | portfolio | stage5 | 10 | Local assets | PASS |
| V-REV-01…03 | reviews | dark canvas/annotate | stage5 + full-cert | 11/12 | Scoped dark | PASS |
| V-VER-01 | versions | compare/history | stage5 | 11 | No pixel-diff claim | PASS |
| V-APR-01 | decisions | approve/changes | stage5 + full-cert | 12 | Immutable approved | PASS |
| V-SCH-01/02 | schedule | reschedule | stage6 + full-cert | 13/20 | Planning preview | PASS |
| V-ANL-01/02 | analytics | filters/SR table | stage6 | 14 | Sample only | PASS |
| V-TEAM-01 | team | workload | stage6 | 15 | Hybrid SoT | PASS |
| V-ORG-01 | members | Foundation | company e2e | (company) | — | PASS |
| V-ACT-01 | activity | source filter | stage6 | 16 | Demo ≠ Audit | PASS |
| V-SET-01 | settings | prefs | stage6 | 17 | Demo prefs labeled | PASS |
| V-INT-01 (V-ORG-02) | integrations | catalog | stage6 + full-cert | 17 | No Connect/keys | PASS |
| V-CERT-01 | evidence pack | — | full-visual-cert-evidence | 01–20 | — | PASS |
| V-CERT-02 | keyboard paths | Esc/focus | stage4/5/6 + a11y-shell | — | Documented in journeys | PASS |
| V-CERT-03 | VG blockers | stages 1–6 | matrix | — | Closed by rebuilds | PASS |
| V-CERT-04 | owner session | preview | `pnpm review:004` | — | PENDING_OWNER | PENDING_OWNER |

**Aliases:** V-CAM→V-CMP, V-CONT→V-CNT, V-ORG-02→V-INT-01.
