# CSS cleanup report — `cursor/css-audit-cleanup-f9b2`

Scope: `stage2.css`, `stage4.css`, `stage5.css` (+ shared tokens). Branch from `004-oma-complete-product-demo`.

## 1. Dead / unused CSS

| File           | Approach                                                                   | Result                                                               |
| -------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **stage2.css** | Selector scan (`pnpm css:audit:scan`)                                      | 61 classes; all `oma-*` / dynamic — **no safe deletes** in this pass |
| **stage4.css** | Removed **verified duplicate** blocks (byte-identical to earlier sections) | **−2,076 lines** (see §3)                                            |
| **stage5.css** | Scan only                                                                  | No orphan deletes; heavy `oma-*` / Ant Design hooks                  |

**Conservative policy (not deleted):**

- Classes with `oma-`, `ant-`, `is-*`, `data-*`, `aria-*`
- Kanban lane accent hex (`--oma-kb-col--*`) — semantic lane colors, kept
- Home/reviews local custom properties inside components (e.g. `--reviews-*`)

**Tool:** `scripts/css-audit/scan-selectors.mjs` — reports only non-dynamic class tokens with zero source hits. Review output before any delete.

## 2. Hardcoded colors → tokens

Added to `packages/ui/src/tokens.css`:

- `--oma-workspace-bg*`, `--oma-workspace-border*`, `--oma-workspace-muted/ink`, tab active pair, kanban board bg/border

**Replaced in `stage4.css` + `stage5.css`** (exact hex → `var(--oma-*)`):

- Neutrals: `#f7f8f9`, `#fafbfc`, `#eef0f2`, `#e8e9eb`, `#e5e7eb`, `#6b7280`, `#111827`, `#8c8c8c`
- Accents: `#e8f1ff`, `#2563eb`
- Surfaces: `#ffffff` / `#fff` → `var(--oma-surface)`
- Kanban shell: `#f6f7f9`, `#eef0f3`

**Kept as hex (documented):**

- Kanban column stripe colors (`#83aeff`, `#8180fd`, …) — lane semantics, not yet tokenized
- Status / badge one-offs in stage5 reviews block (`--reviews-*`局部)
- Social / brand colors (none touched in this pass)

**stage2.css:** already token-based; **no hex replacements** needed.

## 3. Duplication removal (`stage4.css`)

Verified **10 sections** (Requests v2 → choice select) duplicated at lines **3820–5670**, identical to **835–2685**. Removed **3595–5670** (includes partial v1 re-paste + full duplicate run).

**Kept:**

- Lines **1–3594** (original stage4 + first kanban block)
- Lines **3595+** after cut = former **5671+** (extended request top bar, task cards, drawers, etc.)

**`!important`:** not mass-removed in stage4/5 — still required for Planable/Ant Design cascade wars. Each remaining `!important` should be tagged in a future pass when mobile redesign layers subsume stage rules.

**RTL:** existing `border-inline-*`, `inset-inline-*`, `[dir='rtl']` rules preserved; no new physical left/right introduced in this diff.

## 4. Manual visual verification (required)

Verify in browser (LTR + RTL, ≤767px and desktop):

| Surface             | Risk                            |
| ------------------- | ------------------------------- |
| `/app/requests`     | tabs, table wrap, filter drawer |
| `/app/tasks`        | kanban columns/cards            |
| `/app/deliverables` | stage5 parity sections          |
| Request detail      | top bar after dedupe            |

## 5. Commands

```bash
pnpm css:audit:scan
pnpm exec vitest run tests/unit/css-cleanup.test.ts
pnpm format
```

## 6. Follow-ups (not in this PR)

- Tokenize kanban lane accent colors
- Split `stage4.css` into domain partials; delete legacy once `mobile-redesign-v1` owns ops chrome
- PurgeCSS only after route-level ownership map + visual PASS per surface
