# QA R2 fixes — 2026-11-02

Screenshots for `fix/qa-r2-company-select-nov02`.

## Live (post-invite, pre-deploy of UI fixes)

| File                                                | What                                                          |
| --------------------------------------------------- | ------------------------------------------------------------- |
| `owner-home-demo-en.png` / `owner-home-demo-ar.png` | Owner after accepting Demo Agency invite (sees Demo brands)   |
| `owner-select-company-en.png` / `…-ar.png`          | Owner select-company with Demo + ملابس                        |
| `owner-team-after-invite-en.png` / `…-ar.png`       | Team page after admin invite accepted                         |
| `owner-analytics-en.png` / `…-ar.png`               | Analytics (Create report still primary until this PR deploys) |
| `memberA-select-company-en.png`                     | Member A workspace picker (trap fixed in this PR)             |

## Fix previews (local HTML mocking the post-deploy UI)

| File                                              | What                                           |
| ------------------------------------------------- | ---------------------------------------------- |
| `fix-preview-select-company-create-report-en.png` | All companies as cards + demoted Create report |
| `fix-preview-select-company-create-report-ar.png` | Same in Arabic RTL                             |

## Invite result

- Inviter: `abosharekhosama@gmail.com` (Demo owner)
- Invitee: `osamaabusharekh48@gmail.com` → admin on **OMA Demo Agency**
- Accept: 201; owner memberships = ملابس + Demo; 12 brands visible when Demo active
