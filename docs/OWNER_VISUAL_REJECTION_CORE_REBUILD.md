# Owner visual rejection — core experience rebuild

**Status:** `SUPERSEDED` as visual authority by `DEC-017`. Inter/Noto/Linear-shell work here is historical. Owner visual review remains `REJECTED`.

**Date:** 2026-09-14
**Branch:** `004-oma-complete-product-demo`
**Starting SHA:** `ca8a67388a36068eb0144241d474c081dde691fe`
**Feature SHA:** `888c0cc8bfbe0e60be1da19cf51e87d97f2c8e87`
**Evidence SHA:** `e2a12b9945b43042db26946714707bbd09a935df`
**Stage:** `IMPLEMENT_OMA_OWNER_REJECTION_CORE_EXPERIENCE_REBUILD`

## Binding status

| Field                     | Value                          |
| ------------------------- | ------------------------------ |
| OWNER_VISUAL_REVIEW       | REJECTED                       |
| VISUAL_REBUILD            | IN_PROGRESS                    |
| FULL_VISUAL_CERTIFICATION | INVALIDATED_BY_OWNER / REVOKED |
| VISUAL_ACCEPTANCE         | REJECTED                       |
| USER_ACCEPTANCE           | PENDING                        |
| EXTERNAL_INTEGRATIONS     | DEFERRED                       |

## Owner rejection reasons (binding)

1. Kanban not clearly visible.
2. Kanban lacks reference-grade motion/interaction.
3. Typography does not look professional (IBM Plex rejected).
4. UI feels generic vs reference products.
5. IA / usage order unprofessional.
6. Motion, transitions, windows, interactions below references.
7. Features exist but are undiscoverable.
8. Features owner perceives as missing.

Prior `FULL_VISUAL_CERTIFICATION: PASS` is **not** final visual acceptance.

## Core remediation (this stage)

- Inter + Noto Sans Arabic typography (no IBM Plex primary).
- Tasks nav → Board default + saved preference.
- Real Kanban DnD (`@dnd-kit`) with persistence, keyboard/select a11y fallback, invalid-transition feedback.
- Shell/command/home discoverability for Tasks board.
- Central motion tokens for drawers/dialogs/kanban lift; reduced-motion respected.

## Next stage

`IMPLEMENT_OMA_OWNER_REJECTION_SURFACE_DEPTH_REBUILD`
