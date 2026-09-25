# A1 live measurement index

Raw captures stay in gitignored `artifacts/planable-ant-design-a1/`. Sanitized machine metadata also stays in gitignored `.reference/008-planable-ant-design-a1/`. This page has no account identifiers.

## Planable

Read-only CDP session on the already open authenticated product view. No form was submitted and the URL did not change.

| Measure              | Value                                                                                    | Limit                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Body ink             | rgb(51, 51, 51)                                                                          | Matches locked `#333333`                                                      |
| Canvas               | rgb(245, 246, 247)                                                                       | Matches locked `#F5F6F7`                                                      |
| Body / control type  | 14px                                                                                     | Matches locked font size                                                      |
| Visible icon button  | 32×32, radius 6px, transition 0.3s                                                       | Matches control height and radius                                             |
| Focused search input | `ant-input` `ant-input-borderless` `ant-dropdown-trigger`, 14px, radius 6px, height 24px | Borderless search, not the 32px form control                                  |
| Live `ant-*` classes | `ant-input`, `ant-dropdown-trigger`, `ant-badge`, `ant-badge-dot`, `ant-scroll-number`   | Inspected view only                                                           |
| Dropdown menu        | REFERENCE_UNAVAILABLE                                                                    | Trigger exists; no menu stayed open                                           |
| Tab / view switcher  | REFERENCE_UNAVAILABLE                                                                    | No tab was present on the open view                                           |
| Composer overlay     | A `[role=dialog]` / `.modal` shell opened and closed without submit                      | Full-viewport shell, scrim selector did not match, card geometry not measured |
| Package version      | UNPROVEN                                                                                 | Class names do not identify an antd version                                   |

Label: `PLANABLE_ANT_RUNTIME_EVIDENCE: LIVE_VERIFIED_WITHIN_INSPECTED_SCOPE`.

## OMA

`tests/e2e/antd-a1-certification.e2e.ts` captures the isolated stack at EN 1440×900, EN 1024×768, EN 390×844, AR RTL 1440×900, and AR RTL 390×844, then the EN 1440 states: shell, Create Brand focused field with the submit disabled, Create Brand loading, Create Brand validation error, content date picker, content approval dropdown, content composer, Create Request, task drawer, notifications panel, and reduced motion.

PNG files stay gitignored under `artifacts/planable-ant-design-a1/oma/`. Sanitized metadata stays gitignored under `.reference/008-planable-ant-design-a1/oma-captures.json`.

## CI repair

Two push runs failed only in Playwright E2E. Earlier steps, including the production web build and the server health check, succeeded.

| Run         | SHA                                        | URL                                                                  | Job    | Step           | First causal error                                                                                                                                              | Class              |
| ----------- | ------------------------------------------ | -------------------------------------------------------------------- | ------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 36048294405 | `1bd0bf26cb1e2c5c5e89446b8e03994132d8f68b` | https://github.com/burhanbakri1-spec/oma-ai/actions/runs/36048294405 | verify | Playwright E2E | `ChunkLoadError` loading `app/(app)/app/brands/[brandId]/profiles/page` from a dev server that reused the production `.next` output                             | BUILD_OR_HYDRATION |
| 36054174908 | `3e60c2b8e80d3f9a05285b68e2458801154110f8` | https://github.com/burhanbakri1-spec/oma-ai/actions/runs/36054174908 | verify | Playwright E2E | Click on `Review carousel v2` finished without a navigation; the trace then logged `[Fast Refresh] rebuilding`. Received URL stayed `http://127.0.0.1:3000/app` | PROCESS_LIFECYCLE  |

Run 36054174908 is the newest run for `3e60c2b8`. A separate dist dir stopped the stale-chunk error and rewrote `next-env.d.ts` while `next dev` was already serving tests. That rewrite is what Fast Refresh rebuilt, and client navigations during the rebuild did not run. CI also starts `next dev` with `NODE_ENV=test`.

`apps/web/next.config.ts` deletes a finished production `BUILD_ID` only when CI starts `next dev` without `NEXT_DIST_DIR`, and it switches that process from `NODE_ENV=test` to `development`. That stopped the stale-chunk error. Run `36116320431` on `c4d91272eb225d674a19d02f8a51b5670ea48a98` still failed Playwright: the same journeys compiled each route on demand and exceeded the 90s test budget (`demo-activity` was not visible before the test timeout). CI now serves the production build with `next start` after the web build. Local Playwright still starts `next dev` with `NEXT_DIST_DIR=.next-e2e`. No test was skipped and no assertion was removed.

Sanitized failed logs stay gitignored under `artifacts/planable-ant-design-a1/ci/`. A2 surface migration is still open. Owner visual acceptance stays pending.

Sampled desktop Ant button: 32px height, 14px type, 6px radius, ink `rgb(51, 51, 51)`, transition `0.15s`. The first button on the shell is a text icon button, so its background is transparent. Primary blue is the theme token `#1677FF`. At 390px the first sampled button is in the hidden rail, so its measured height is 0; the desktop control contract is the 32px sample. Reduced motion shortens the sampled transition to a near-zero duration. No hydration error and no horizontal overflow were recorded on these shots. The recapture after the foundation commit records tree `9ec6779abbd3d862b40d2548be73eaee631e6e95` and 15 shots. Raw files stay gitignored.
