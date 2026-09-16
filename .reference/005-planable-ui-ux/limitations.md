# Planable UI/UX evidence limitations

**Decision:** DEC-017
**Access:** CDP_READY_AUTHENTICATED on `app.planable.io` (2026-09-16)
**Mutations:** none

## This-run LIVE

- Approvals shell at 1440×900 (best geometry: 256px rail, type, primary button, search, 150ms/300ms motion).
- Campaigns `/all` at 1440×900 (256px rail).
- Dashboard at 1440, 1024, 390 (no overflow; mobile hamburger).

## Partial / gated / missing

| Item | Status | Why |
| --- | --- | --- |
| Calendar cells / DnD | PARTIAL | This run hit `loaderSplashScreen` only. Use ARCHIVED LIVE from 002 for structure. |
| View switcher menu | PARTIAL | `viewSelector` missing on approvals; ARCHIVED menu: Calendar, Feed, Grid PRO, List ENT. |
| Feed canvas | NOT LIVE | Historical 404 on `/feed/{id}`; needs in-app switcher. |
| Grid / List | PLAN_GATED | Account shows PRO/ENT. |
| Composer | CONTROL_NOT_FOUND on dashboard | ARCHIVED compose modal from sample workspace. |
| Settings / members / roles tables | SANDBOX_DATA_REQUIRED | Invite/settings not opened (invite is a mutation surface). |
| Arabic / RTL | NOT IN SESSION | English LTR only. |
| Reduced motion | NOT OBSERVED | |
| Unsaved composer prompt | NOT OBSERVED | Would require typing; avoided. |
| Billing / upgrade / connect / approve | FORBIDDEN | Never opened. |
| Marketing tokens | EXCLUDED | `planable.io` not used for components. |

## Privacy

- Raw screenshots stay under `.reference/005-planable-ui-ux/raw-screenshots/` (gitignored).
- Stored JSON strips person names, company names, and opaque ids to `{userName}`, `{workspaceName}`, `{id}`.
- Do not commit cookies, tokens, or account emails.

## False-parity

- Do not treat 002 archived notes as 2026-09-16 geometry except where this run re-measured.
- Do not treat OMA Inter/violet certification as Planable parity.
- Do not treat Linear density or Frame.io dark canvas as Planable.
