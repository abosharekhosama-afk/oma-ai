# Visual Acceptance Baseline — OMA at `1a7453c`

Screenshots of the running Feature 002 application **before any implementation fix**. Files live
under the git-ignored directory `.reference/002-gap-evidence/shots/`.

**Served SHA:** `1a7453c` · **Captured:** 2026-08-30 · **Stack:** local Postgres + Redis + API +
Worker + Web on loopback.

## Index

| File                            | Route                   | Actor                   | Locale | Viewport | State                                                | Gap                      |
| ------------------------------- | ----------------------- | ----------------------- | ------ | -------- | ---------------------------------------------------- | ------------------------ |
| `01-root-unauth.png`            | `/`                     | anonymous               | en     | 1440×900 | unauthenticated landing                              | `G-024`                  |
| `02-login.png`                  | `/login`                | anonymous               | en     | 1440×900 | login form                                           | —                        |
| `03-register.png`               | `/register`             | anonymous               | en     | 1440×900 | register form                                        | `G-002`                  |
| `04-fresh-landing.png`          | `/app`                  | fresh registrant        | en     | 1440×900 | zero memberships / no company                        | `G-001`, `G-002`         |
| `05-brands-empty.png`           | `/app` (nav attempt)    | fresh registrant        | en     | 1440×900 | stuck without company; Brand Intelligence not usable | `G-001`                  |
| `10-relogin-landing.png`        | `/app`                  | returning fresh user    | en     | 1440×900 | still no company after login form                    | `G-001`                  |
| `11-owner-landing.png`          | `/app`                  | platform owner          | en     | 1440×900 | select-a-company; 216 memberships                    | `G-003`, `G-005`         |
| `12-owner-brands.png`           | `/app/brands`           | platform owner          | en     | 1440×900 | `TENANT_REQUIRED` guidance, no active company        | `G-003`                  |
| `13-ar-desktop-home.png`        | `/app`                  | fresh owner             | ar     | 1440×900 | RTL shell                                            | —                        |
| `13-en-tablet-home.png`         | `/app`                  | fresh owner             | en     | 1024×768 | tablet shell                                         | —                        |
| `13-en-mobile-home.png`         | `/app`                  | fresh owner             | en     | 390×844  | mobile shell                                         | —                        |
| `14-ar-desktop-brands.png`      | `/app/brands`           | fresh owner             | ar     | 1440×900 | RTL brands (no company)                              | `G-001`                  |
| `14-en-tablet-brands.png`       | `/app/brands`           | fresh owner             | en     | 1024×768 | tablet                                               | —                        |
| `14-en-mobile-brands.png`       | `/app/brands`           | fresh owner             | en     | 390×844  | mobile                                               | —                        |
| `20-home-with-tenant.png`       | `/app`                  | owner + active company  | en     | 1440×900 | populated home card                                  | —                        |
| `21-brands-empty-tenant.png`    | `/app/brands`           | owner + fresh company   | en     | 1440×900 | empty brand list with Create brand                   | —                        |
| `22-create-brand-form.png`      | `/app/brands/new`       | owner                   | en     | 1440×900 | create form                                          | —                        |
| `23-brand-overview.png`         | `/app/brands/{id}`      | owner                   | en     | 1440×900 | overview, no website                                 | —                        |
| `24-connect-website.png`        | `…/connect`             | owner                   | en     | 1440×900 | connect form + attestation                           | —                        |
| `25-brand-connected.png`        | `/app/brands/{id}`      | owner                   | en     | 1440×900 | website connected                                    | —                        |
| `26-scan-new.png`               | `…/scans/new`           | owner                   | en     | 1440×900 | crawl bounds disclosed                               | `G-006`                  |
| `27-scan-running.png`           | `…/scans/{id}`          | owner                   | en     | 1440×900 | scan in progress / early                             | —                        |
| `28-scan-terminal.png`          | `…/scans/{id}`          | owner                   | en     | 1440×900 | `PARTIAL` terminal                                   | —                        |
| `29-discovery-pages.png`        | `…/discovery/pages`     | owner                   | en     | 1440×900 | pages list + fixture banner                          | —                        |
| `29-discovery-products.png`     | `…/discovery/products`  | owner                   | en     | 1440×900 | products list                                        | —                        |
| `30-profiles-list.png`          | `…/profiles`            | owner                   | en     | 1440×900 | version index                                        | —                        |
| `31-profile-draft.png`          | `…/profiles/{v}`        | owner                   | en     | 1440×900 | draft (early probe, wrong link)                      | —                        |
| `35-compare.png`                | `…/compare`             | owner                   | en     | 1440×900 | early probe mis-routed                               | —                        |
| `36-unknown-brand.png`          | `/app/brands/{unknown}` | owner                   | en     | 1440×900 | not found                                            | —                        |
| `40-version-list.png`           | `…/profiles`            | owner                   | en     | 1440×900 | `NEEDS_REVIEW` + AI unavailable                      | —                        |
| `41-profile-draft.png`          | `…/profiles/{v}`        | owner                   | en     | 1440×900 | sections + evidence buttons; leaked i18n key         | `G-010`                  |
| `42-evidence-panel.png`         | `…/profiles/{v}`        | owner                   | en     | 1440×900 | evidence side panel open                             | —                        |
| `43b-approve-blocked.png`       | `…/profiles/{v}`        | owner                   | en     | 1440×900 | approve disabled until both gates                    | `G-013`                  |
| `46-compare.png`                | `…/compare`             | owner                   | en     | 1440×900 | no approved version yet                              | —                        |
| `47-cross-tenant-denied.png`    | `/app/brands/{foreign}` | owner in other company  | en     | 1440×900 | `Not found`                                          | `G-019`                  |
| `50-approved-final.png`         | `…/profiles/{v}`        | owner                   | en     | 1440×900 | `APPROVED`                                           | `G-013`                  |
| `51-compare-approved.png`       | `…/compare`             | owner                   | en     | 1440×900 | field-level comparison                               | `G-015`                  |
| `60-demo-home-en-desktop.png`   | `/app`                  | owner + OMA Demo Agency | en     | 1440×900 | brand count 4                                        | `G-005` contrast         |
| `60-demo-home-ar-desktop.png`   | `/app`                  | owner + demo            | ar     | 1440×900 | RTL populated                                        | —                        |
| `60-demo-home-en-tablet.png`    | `/app`                  | owner + demo            | en     | 1024×768 | tablet populated                                     | —                        |
| `60-demo-home-en-mobile.png`    | `/app`                  | owner + demo            | en     | 390×844  | mobile populated                                     | —                        |
| `61-demo-brands-en-desktop.png` | `/app/brands`           | owner + demo            | en     | 1440×900 | four demo brands                                     | proves product not blank |
| `61-demo-brands-ar-desktop.png` | `/app/brands`           | owner + demo            | ar     | 1440×900 | RTL brands                                           | —                        |
| `61-demo-brands-en-tablet.png`  | `/app/brands`           | owner + demo            | en     | 1024×768 | tablet brands                                        | —                        |
| `61-demo-brands-en-mobile.png`  | `/app/brands`           | owner + demo            | en     | 390×844  | mobile brands                                        | —                        |
| `70-scan-after-retry.png`       | `…/scans/{newId}`       | owner                   | en     | 1440×900 | new attempt after Retry                              | `G-007`, `G-008`         |
| `71-brand-overview-full.png`    | `/app/brands/{id}`      | owner                   | en     | 1440×900 | latest scan PARTIAL; no aggregate click-through      | `G-009`                  |

## Reading rules

- A screenshot proves presentation, not backend behaviour.
- `11-owner-landing.png` vs `61-demo-brands-en-desktop.png` is the visual proof of the root cause:
  the shell works; the account had no usable active company.
- `04-fresh-landing.png` proves the self-registration dead end.
- `41-profile-draft.png` is the visual evidence for the leaked `brand.profile.section.evidence_refs`
  heading (`G-010`).
- No screenshot contains cookies, tokens, emails, or organization identifiers beyond disposable
  local demo names.
