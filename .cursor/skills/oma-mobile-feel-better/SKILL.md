---
name: oma-mobile-feel-better
description: >-
  Apply jakubkrehel/make-interfaces-feel-better polish on OMA web mobile (≤767px).
  Use with mobile UI redesign, "feels off" mobile layouts, or after oma-deliver-change UI work.
  Loads vendored skill at .agents/skills/make-interfaces-feel-better and OMA CSS constraints.
---

# OMA mobile + make-interfaces-feel-better

## 1. Read (mandatory)

1. `.agents/skills/make-interfaces-feel-better/SKILL.md` (+ `surfaces.md`, `typography.md`, `animations.md` as needed).
2. `docs/DESIGN_REFERENCE_STRATEGY.md`, `docs/PLANABLE_DESIGN_TOKENS_SPEC.md`.
3. Mobile CSS order in `apps/web/src/app/globals.css` (ends with `mobile-surfaces-clean.css`, `mobile-feel-better.css`).

## 2. OMA constraints (override generic skill defaults)

| Rule           | OMA                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------ |
| Styling system | Plain CSS + Ant Design tokens via `OmaAntdProvider`; **no Tailwind**                             |
| Document scale | No `html { zoom }`; density via tokens + per-surface layout                                      |
| Touch targets  | Prefer 44×44px hit area; compact **visible** chrome may be 28–34px if pseudo-element extends tap |
| Inputs         | Computed **≥16px** on focused fields (iOS); compact labels ok at 11–13px                         |
| Actions        | `oma-action-bar` — buttons **wrap**, not full-width blocks                                       |
| Motion         | Respect `prefers-reduced-motion` (`packages/ui/src/motion.css`); no stagger on list scroll       |
| Authority      | Planable density (`DEC-017`); borders for structure, light shadow for card elevation on mobile   |

## 3. Implementation workflow

1. Name **route family** (requests detail, deliverables, brand workspace, …).
2. Audit conflicting mobile rules: `rg 'width: 100%|flex: 1 1 100%'` under target components in `apps/web/src/styles`.
3. Layout/density → `mobile-surfaces-clean.css` (structure).
4. Polish (radius concentric, shadow, press scale, tabular nums, text-wrap) → `mobile-feel-better.css`.
5. Markup tweaks only when needed (`oma-action-bar`, semantic headings).
6. `pnpm format`; `vitest tests/unit/mobile-density.test.ts`.

## 4. Review mode

Use **quick** mode from the vendored skill for a single screen; **full** only when user asks app-wide audit.

Report findings in the vendored review table format; file paths under `apps/web/src/`.

## 5. Surface tracker

Update this table when a family is polished:

| Family                     | Layout (`mobile-surfaces-clean`) | Feel (`mobile-feel-better`) |
| -------------------------- | -------------------------------- | --------------------------- |
| Requests detail/list       | yes                              | yes                         |
| Deliverable detail         | yes                              | yes                         |
| Content / tasks / settings | pending                          | pending                     |
| Brand workspace            | partial                          | partial                     |
