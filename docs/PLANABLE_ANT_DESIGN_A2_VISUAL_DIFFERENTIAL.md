# Planable Ant Design A2 visual differential

## Before

Product pages rendered native `button`, `input`, `select`, and `textarea` elements skinned by `packages/ui/src/primitives.css` (`.oma-btn`, `.oma-input`, `.oma-select`, `.oma-textarea`). Six Ant Design pilot surfaces already used `@oma/ui/controls`.

## After

Those native controls now render through `@oma/ui` adapters (`Button`, `Input`, `PasswordInput`, `TextArea`, `SelectField`, `CheckboxField`, `DateField`). Pressed view switchers use Ant `primary` instead of a page-local button skin. Page CSS no longer paints raw `button` / `input` / `textarea` / `select` rules. Kanban drag remains `@dnd-kit`.

Shared `primitives.css` still paints `.oma-btn` for Next.js links that are navigation, not form controls. That file is the shared layer already allowed by the runtime style inventory.

## Gates

`scripts/ui/inventory-runtime-styles.mjs` after the migration:

| Gate                       | Count |
| -------------------------- | ----: |
| High visual gaps           |     0 |
| Medium visual gaps         |     0 |
| Page-local control visuals |     0 |
| Runtime legacy aliases     |     0 |
| `#6658E8` / `#121419`      |     0 |

Screenshots are local and gitignored. This document does not claim a new live Planable capture.

## Evidence levels

| Pattern                                       | Level                 |
| --------------------------------------------- | --------------------- |
| Color, type, radius, control height           | OFFICIAL_DOC_VERIFIED |
| Ant Design control behavior and theme binding | OMA_ADAPTATION        |
| Live Planable re-measure in this stage        | REFERENCE_UNAVAILABLE |
