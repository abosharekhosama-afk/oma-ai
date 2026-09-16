# P1 verification — independent read-only audits

Parent sequential audits against the P1 worktree and live Playwright evidence. No product files were changed by these audits.

## 1. Planable token/shell verifier — PASS

- Single `:root` in `packages/ui/src/tokens.css`. Stage CSS has no competing `:root`.
- LIVE computed (`01-workspace-shell-1440.json`): canvas `rgb(245,246,247)`, ink `rgb(51,51,51)`, surface `rgb(255,255,255)`, primary `rgb(22,119,255)`, rail 256px, button 32px / 6px, rail motion `0.15s linear`.
- English font: `-apple-system, system-ui, "Segoe UI", Roboto…` (no Inter).
- Shell chrome: search, workspace, notifications, user in the rail (shots 01, 04, 06). Create in content header (shot 05).
- P1 defect found and fixed before commit: tablet 1024 / mobile drawer footer overlapped nav. `.oma-nav` now scrolls inside the rail; footer stays at the bottom. Dev-only Next.js `N` badge can still cover the footer in local screenshots; production chrome does not include it.

## 2. Typography/RTL verifier — PASS

- EN: system-UI stack, 14px body.
- AR (`09-ar-rtl-1440.json`): `dir=rtl`, computed family starts with `Noto Sans Arabic`.
- `i18n-rtl.e2e.ts` and `shell-stage1` RTL border-inline-end passed in the P1 regression run.

## 3. Legacy-style contamination verifier — PASS (with tracked exceptions)

- No `--oma-primary: #6658` in CSS. `--oma-violet` aliases to `#1677FF`.
- No Inter/IBM Plex in layout or tokens.
- Stage CSS does not overlay a second palette via `:root`.
- Demo SVGs under `apps/web/public/demo/` still contain violet/dark fills — **not token SoT**; tracked in `docs/PLANABLE_P1_DEMO_SVG_DEFERRED.md` for P3/P5. They do not appear in P1 shell shots 01–06/10–12.

## 4. Accessibility/motion verifier — PASS

- `a11y-shell.e2e.ts` passed (labels, main, Tab).
- Search dialog and mobile drawer close with Escape (`shell-stage1`, evidence pack).
- Reduced motion: create/rail transition computed `1e-05s` (~0.01ms) under `prefers-reduced-motion: reduce`.
- Focus ring uses `--oma-primary`. Color is not the only status signal (chips keep text).

## 5. False-completion verifier — PASS

- P1 is tokens/shell/primitives/motion, not P2–P6 surface rebuilds. Page modules for campaigns/content/tasks/reviews were not rewritten.
- Visual acceptance remains `REJECTED`. Owner visual review remains `REJECTED`.
- `PLANABLE_UI_UX_IMPLEMENTATION: IN_PROGRESS` with `PLANABLE_UI_UX_STAGE_P1: COMPLETE` is the honest state.
- Playwright evidence is computed-style + screenshots, not “CSS variable names exist”.
