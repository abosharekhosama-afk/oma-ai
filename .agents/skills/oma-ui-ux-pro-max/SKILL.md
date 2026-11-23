---
name: oma-ui-ux-pro-max
description: >-
  OMA wrapper for nextlevelbuilder/ui-ux-pro-max: run UX searches then implement
  in Planable-aligned CSS (DEC-017), not Tailwind. Use when all mobile surfaces
  still feel wrong after token/surface passes.
---

# OMA + UI UX Pro Max

## Authority stack (do not invert)

1. User request
2. `DEC-017` / `docs/PLANABLE_DESIGN_TOKENS_SPEC.md`
3. **Vendored** `.agents/skills/ui-ux-pro-max/` (search + guidelines)
4. `.agents/skills/make-interfaces-feel-better/` (micro-polish)
5. Implementation CSS (last wins): `mobile-surfaces-clean.css` → `mobile-feel-better.css` → `mobile-ux-pro-max-reset.css`

## Run searches (from repo root)

```bash
pnpm ux:search -- "touch target spacing" --domain ux
pnpm ux:search -- "marketing workspace saas" --design-system -p "OMA AI" --direction rtl
pnpm ux:search -- "app router css modules ant design" --stack nextjs
```

Skill path: `.agents/skills/ui-ux-pro-max/scripts/search.py`

## OMA translation rules

| Pro Max says (often Tailwind) | OMA implementation                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `gap-2`, 8dp rhythm           | `gap: 8px` in mobile layers                                                                          |
| 44pt touch                    | `--oma-tap: 44px` + pseudo hit slop                                                                  |
| Mobile-first                  | `@media (max-width: 767px)` only; never `html { zoom }`                                              |
| Design system output          | Map colors to existing CSS vars in `packages/ui/src/tokens.css` — **do not** invent a second palette |
| Full-width CTAs               | **Avoid** on phone; use `oma-action-bar` wrap                                                        |

## Fix order when “everything feels bad”

1. **Conflicts** — `rg '!important' apps/web/src/styles/stage4.css` vs `mobile-*` for the route’s class names.
2. **Tables on phone** — replace horizontal `min-width: 760px` tables with cards/board where product already has a mobile pattern (requests cards, kanban).
3. **Layout** — `mobile-surfaces-clean.css` per route family.
4. **Polish** — `mobile-feel-better.css`.
5. **Reset** — `mobile-ux-pro-max-reset.css` wins over legacy `stage4`/`mobile-oct27` padding on `.oma-shell` only.
6. Verify 375px EN + AR, reduced motion, `pnpm format`, `vitest tests/unit/mobile-density.test.ts`.

## Persisted design system (optional)

Only if the user explicitly authorizes:

```bash
pnpm ux:search -- "B2B marketing operations dashboard" --design-system --persist -p "OMA AI" --output-dir "$(pwd)"
```

Read `design-system/oma-ai/MASTER.md` before applying; merge into tokens/spec, not parallel hex in components.
