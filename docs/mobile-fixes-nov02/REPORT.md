# Permissions + mobile fixes — Nov 02

Backup branch: `backup-before-mobile-fixes-nov02` (from `a2a71b3`)
Work branch: `fix/permissions-mobile-nov02`

## Part A — bug fixes

1. **VIEWER brand role strips granted write caps** — `VIEWER_EXTRA` keeps request.create/write, content.update/create/approve, deliverable annotate/review when granted. CLIENT system profile now includes request.create/read + content.update. Migration `20261102220000_client_request_comment_caps`. Request routes use `request.*` caps.
2. **Deliverable submit blocked at guard** — review route capability list is `[]`; `OpsService.assertReviewCapability` enforces submit→deliverable.write, decide→review.decide.
3. **APPROVER cannot comment** — APPROVER brand role allows `content.update`.
4. **TikTok stuck QUEUED / image-as-REEL / profile URL** — reel_requires_video fail-fast; status poll 10s→60s backoff + 30m timeout→FAILED; `/photo/{id}` vs `/video/{id}`; profile-only URLs labeled “View profile”.
5. **Timezone missing Asia/Gaza** — `timezoneOptions(ensure)` always includes Asia/Gaza & Asia/Hebron and the stored value.
6. **Review actions from NOT_STARTED** — UI hides decision buttons with bilingual hint until submit is legal.
7. **Brand page 404 for non-member** — treat NOT_FOUND as no-access (`errors.brandNoAccess`).

## Part B — mobile

- New `apps/web/src/styles/mobile-nov02.css` (scoped ≤767px + light tablet): safe-area, 16px inputs, icon-only header actions, nav drawer overlay/pinned footer, sticky filter chips, tables/cards, full-screen modals, composer/calendar tweaks, no horizontal page scroll, Arabic wrap.
- Desktop styles unchanged outside max-width media queries.

## Verification

- Typecheck: domain, i18n, api, worker, web — pass
- Focused tests: brand-access, plan-permissions, social-adapters, media-constraints, publish-errors, deliverable-review contract, plan-enforcement — pass
- Lockfile: unchanged
- Migrations: added `20261102220000_client_request_comment_caps`
- Screenshots: `/workspace/mobile-fixes-nov02/{before,after,desktop}/`

## Not done / notes

- Full authenticated API/UI live verification against Motaz/Maher accounts not re-run in this session (local app was up; Playwright shots hit public/login surfaces without session cookies).
- Broader unit suite has many pre-existing failures unrelated to this branch.
