# Foundation verification checklist

**Date:** 2026-08-25
**Branch:** `001-oma-ai-product-foundation`
**Mode evidence:** IMPLEMENT

## Evidence

- [x] Unit tests for domain auth/capabilities/ports/i18n (`pnpm test` — 21 files / 28 tests)
- [x] Integration/contract/security tests against real Postgres + Redis
- [x] Playwright E2E matrix EN/AR + 1440/1024/390 (`40 passed`)
- [x] DEC-003–DEC-012 remain open; ports refuse unconfigured providers
- [x] No IMKAN SSO dependency
- [x] No production AI/storage/email/ad vendor selected
- [x] Format check (`pnpm format`)
- [x] Lint (`pnpm lint`)
- [x] Typecheck (`pnpm typecheck`)
- [x] Production builds: `@oma/api`, `@oma/worker`, `@oma/web` (`NODE_ENV=production`)
- [x] T096–T101 left blocked by Decision Gates

## False-completion audit

- Real persistence via Prisma/Postgres: yes
- Tenant isolation negative tests: yes
- CSRF negative tests: yes
- Worker re-authz coverage: yes
- Blocked product slices not implemented: yes
- Secrets not committed (`.env` gitignored; `.env.example` descriptive only): yes

## Implementation notes (durable deviations)

- Vitest uses root `vitest.config.ts` plus `vitest.workspace.ts` (T004).
- Nest controllers use `apps/api/src/container.ts` singletons so Vitest/tsx runs without decorator metadata.
- Local Postgres/Redis via Homebrew services when Docker Compose is unavailable; Compose file remains the documented default.
- Default connector/AI adapters refuse operation until the matching DEC is resolved.
