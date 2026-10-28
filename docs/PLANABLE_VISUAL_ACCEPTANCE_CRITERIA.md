# Planable visual acceptance criteria (OMA)

**Status:** Binding after `DEC-017`. Previous `docs/VISUAL_ACCEPTANCE_CRITERIA.md` V-SHELL Linear numbers are **not** acceptance for Planable rebuild.
**Owner visual review:** remains `REJECTED` until owner accepts a Planable rebuild.
**Forbidden proofs:** tests green, “looks Planable”, Linear leftover, Inter-only proof, Frame dark canvas.

## Global (`PV-G-*`)

| ID      | Criterion                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------- |
| PV-G-01 | Single token set from `docs/PLANABLE_DESIGN_TOKENS_SPEC.md`                                                       |
| PV-G-02 | English computed `font-family` is the system-UI stack (not Inter/IBM Plex as the Planable match)                  |
| PV-G-11 | Arabic text uses OMA's Noto Sans Arabic face, with a system fallback; EN/AR typography remains legible in LTR/RTL |
| PV-G-12 | Shell/navigation icons use a consistent, accessible 24-unit outline SVG style with current-color strokes          |
| PV-G-03 | Canvas `#F5F6F7`, surface `#FFFFFF`, ink `#333333`, primary `#1677FF` within 2/255 RGB                            |
| PV-G-04 | Control radius 6px ±1; primary height 32px ±2                                                                     |
| PV-G-05 | No Planable logo, name, screenshots, or copy inside OMA                                                           |
| PV-G-06 | No Linear/Frame/Workfront/ClickUp visual chrome                                                                   |
| PV-G-07 | No marketing-site hero type or gradients                                                                          |
| PV-G-08 | Color not the only status signal                                                                                  |
| PV-G-09 | EN+AR, LTR/RTL, no overflow at 1440/1024/390                                                                      |
| PV-G-10 | Demo/external honesty unchanged                                                                                   |

## Shell (`PV-SHELL-*`)

| ID          | Criterion                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| PV-SHELL-01 | Workspace rail width **256px ±4** expanded                                                                           |
| PV-SHELL-02 | Search, workspace switcher, notifications, user live in the Planable-like rail (not a Linear 56px bar as the system) |
| PV-SHELL-03 | Sidebar motion **150ms linear** ±30ms                                                                                |
| PV-SHELL-04 | Primary action **300ms** standard ease ±50ms                                                                         |
| PV-SHELL-05 | 390px: hamburger or equivalent; no horizontal overflow                                                               |

## Content (`PV-CNT-*`)

| ID        | Criterion                                                                       |
| --------- | ------------------------------------------------------------------------------- |
| PV-CNT-01 | Calendar, Feed, Grid, List are first-class views                                |
| PV-CNT-02 | Cards are media-first                                                           |
| PV-CNT-03 | Comments and approvals sit beside the preview                                   |
| PV-CNT-04 | Composer is a modal/drawer in Planable density; Escape cancels; no fake publish |

## Rebuild gates

P1 cannot be accepted on Inter + violet + Linear shell.
P7 requires new screenshots/videos from the Planable token build, not owner-remediation-004 artifacts.
