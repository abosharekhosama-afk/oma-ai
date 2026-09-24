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

Sampled desktop Ant button: 32px height, 14px type, 6px radius, ink `rgb(51, 51, 51)`, transition `0.15s`. The first button on the shell is a text icon button, so its background is transparent. Primary blue is the theme token `#1677FF`. At 390px the first sampled button is in the hidden rail, so its measured height is 0; the desktop control contract is the 32px sample. Reduced motion shortens the sampled transition to a near-zero duration. No hydration error and no horizontal overflow were recorded on these shots. The candidate identity in the metadata is replaced with the committed SHA after the foundation commit.
