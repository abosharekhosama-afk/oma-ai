# Pixel Parity — Screen Inventory

**Method:** `PIXEL_LEVEL_REFERENCE_PARITY`  
**Manifest:** `.reference/009-planable-pixel-parity/manifest.json`  
**Validator:** `pnpm ui:pixel-parity-coverage`

| ID            | Feature      | Surface        | Viewports     | Locales | Planable             | OMA before | OMA after | Status            |
| ------------- | ------------ | -------------- | ------------- | ------- | -------------------- | ---------- | --------- | ----------------- |
| SCR-CP-CAL    | Content Plan | Calendar month | 1440,1024,390 | en, ar  | LIVE_VERIFIED        | YES        | WIP       | OPEN              |
| SCR-CP-FEED   | Content Plan | Feed           | 1440          | en      | ACCESS_BLOCKED→retry | YES        | WIP       | OPEN              |
| SCR-CP-GRID   | Content Plan | Grid           | 1440          | en      | ACCESS_BLOCKED→retry | YES        | WIP       | OPEN              |
| SCR-CP-LIST   | Content Plan | List           | 1440          | en      | ACCESS_BLOCKED→retry | YES        | WIP       | OPEN              |
| SCR-SHELL     | Shell        | Command center | 1440          | en      | LIVE_VERIFIED        | YES        | PENDING   | BLOCKED_BY_GOLDEN |
| SCR-CAMPAIGNS | Campaigns    | Portfolio      | 1440          | en      | PENDING              | YES        | PENDING   | BLOCKED_BY_GOLDEN |

Raw PNGs: `artifacts/oma-planable-pixel-parity/` (gitignored).
