# Planable design tokens spec (OMA implementation contract)

**Status:** SPEC only. No CSS/variables in product code in this stage.
**Authority:** `DEC-017` · live `app.planable.io` computed styles 2026-09-16 · evidence `.reference/005-planable-ui-ux/measurements/`
**Originality:** OMA implements equivalent tokens. Do not copy Planable logo, wordmark, or proprietary icons.

Every token lists a **source**. Tokens without a live computed value are `ARCHIVED`, `DOC`, or `OMA_ADAPTATION` and must not be claimed as fresh LIVE.

## 1. Typography

| Token                      | Value                                                                               | Source                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `--oma-font-sans`          | `-apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | LIVE body `fontFamily` on approvals/dashboard                                                                          |
| `--oma-font-arabic`        | `"Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif`                                | `OMA_ADAPTATION` — no AR live on Planable this session                                                                 |
| `--oma-text-html-root`     | `10px` on `html`                                                                    | LIVE (app uses 10px root; 14px body = 1.4rem)                                                                          |
| `--oma-text-body`          | `14px` / `~21.5px` / `400` / `#333333`                                              | LIVE `body`                                                                                                            |
| `--oma-text-control`       | `14px` / `22px` / `400`                                                             | LIVE buttons and search                                                                                                |
| `--oma-text-input`         | `14px` / `22px` / `400` / `rgba(0,0,0,0.88)`                                        | LIVE `global-search-input`                                                                                             |
| `--oma-text-on-primary`    | `#FFFFFF`                                                                           | LIVE primary button                                                                                                    |
| Page title / section title | Not isolated this run (no `h1` in captured shells)                                  | `ARCHIVED` + `SANDBOX_DATA_REQUIRED` for exact display sizes; until re-measured, do not invent marketing display sizes |

Do **not** use Inter or IBM Plex as the Planable-matching English face. Inter was an OMA owner-remediation choice, not a Planable computed face.

## 2. Color

| Token                                    | Value                                 | Role                     | Source                                                                                                                         |
| ---------------------------------------- | ------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `--oma-canvas`                           | `#F5F6F7`                             | App background           | LIVE `body.backgroundColor rgb(245,246,247)`                                                                                   |
| `--oma-surface`                          | `#FFFFFF`                             | Rail / cards / dashboard | LIVE `navBody` / sidebar fill                                                                                                  |
| `--oma-ink`                              | `#333333`                             | Primary text             | LIVE `body.color rgb(51,51,51)`                                                                                                |
| `--oma-ink-strong`                       | `rgba(0,0,0,0.88)`                    | Input text               | LIVE search                                                                                                                    |
| `--oma-primary`                          | `#1677FF`                             | Primary action           | LIVE `reviewPostsButton` `rgb(22,119,255)`                                                                                     |
| `--oma-primary-ink`                      | `#FFFFFF`                             | Text on primary          | LIVE                                                                                                                           |
| `--oma-focus-glow`                       | primary at ~40% (oklab ring observed) | Focus/hover halo         | LIVE `boxShadow` / `outline` on primary                                                                                        |
| Success / warning / danger / draft chips | Not isolated as hex this run          | Status                   | `ARCHIVED` labels + `OMA_ADAPTATION`: color never sole signal                                                                  |
| Review dark canvas                       | **Not a Planable app-wide token**     | —                        | Frame.io visual system **revoked**. Media preview stays light-modal unless a later Planable live capture proves a dark canvas. |

DEC-013 OMA Violet `#6658E8` and Signal Teal `#12A7A1` are **not** Planable app tokens. They must not remain the product primary after Stage P1.

## 3. Geometry

| Token                      | Value                                                                  | Source                                                                                  |
| -------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `--oma-sidebar-width`      | `256px`                                                                | LIVE `navSidebar` width on approvals + campaigns 1440                                   |
| `--oma-sidebar-collapsed`  | Toggle exists (`toggleSidebar`, `sidebar-collapse`)                    | LIVE controls; collapsed pixel width `SANDBOX_DATA_REQUIRED`                            |
| `--oma-control-height`     | `32px`                                                                 | LIVE primary button                                                                     |
| `--oma-control-pad-x`      | `16px`                                                                 | LIVE primary `padding: 0 16px`                                                          |
| `--oma-control-gap`        | `8px`                                                                  | LIVE button `gap` and header cluster                                                    |
| `--oma-radius-control`     | `6px`                                                                  | LIVE buttons and inputs                                                                 |
| `--oma-search-height-rail` | `24px` (compact in rail)                                               | LIVE search box                                                                         |
| `--oma-chrome-inset`       | `12px`                                                                 | LIVE header cluster `x/y`                                                               |
| Elevation                  | Mostly `box-shadow: none` on body/rail; primary uses a soft focus ring | LIVE                                                                                    |
| Overlay                    | Not hex-sampled                                                        | `ARCHIVED` modal overlay; measure in P1 implementation against live screenshots locally |

## 4. Motion (see also motion spec)

| Token                  | Value                                | Source                                                |
| ---------------------- | ------------------------------------ | ----------------------------------------------------- |
| `--oma-motion-sidebar` | `150ms linear`                       | LIVE `navSidebar.transitionDuration 0.15s` / `linear` |
| `--oma-motion-control` | `300ms cubic-bezier(0.4, 0, 0.2, 1)` | LIVE primary button                                   |
| `--oma-motion-input`   | `300ms ease`                         | LIVE search                                           |

Reduced motion: **not observed** on the live session (`OMA_ADAPTATION`: honor `prefers-reduced-motion: reduce` → 0–1ms).

## 5. Iconography

Planable uses compact line/glyph icons in the rail (channels, help, bell). OMA must use **original icon set** with the same size class (control 32px, inline ~16–20px — 32px confirmed LIVE; glyph size `ARCHIVED`/`SANDBOX_DATA_REQUIRED`). Never copy Planable SVG marks.

## 6. Implementation rule

Stage P1 maps these tokens to OMA CSS variables. Do not keep a second Linear/Frame token sheet.
