#!/usr/bin/env bash
# Feature 002 certification gate runner — isolated e2e DB, deterministic bootstrap.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export NODE_ENV=test
export OMA_ENV=test
export DATABASE_URL="${E2E_DATABASE_URL:-postgresql://oma@127.0.0.1:5432/oma_ai_e2e?schema=public}"
export E2E_DATABASE_URL="$DATABASE_URL"
export REDIS_URL="${E2E_REDIS_URL:-redis://127.0.0.1:6379/1}"
export BOOTSTRAP_PLATFORM_OWNER_EMAIL="${BOOTSTRAP_PLATFORM_OWNER_EMAIL:-platform-owner@example.com}"
export BOOTSTRAP_PLATFORM_OWNER_PASSWORD="${BOOTSTRAP_PLATFORM_OWNER_PASSWORD:-ChangeMe_PlatformOwner_1!}"
export BRAND_FIXTURE_CONNECTOR=1
export OMA_CERTIFICATION=1
export RATE_LIMIT_PER_MINUTE="${RATE_LIMIT_PER_MINUTE:-0}"
export MAIL_PROVIDER=recording
export WEB_PORT=3000
export API_PORT=3001
export WORKER_HEALTH_PORT=3002
export WEB_BASE_URL=http://127.0.0.1:3000
export WEB_ORIGIN=http://127.0.0.1:3000
export API_PUBLIC_URL=http://127.0.0.1:3001

if ! echo "$DATABASE_URL" | grep -Eqi 'oma_ai_e2e|oma_ai_ci'; then
  echo "Refusing cert runner: DATABASE_URL must be oma_ai_e2e or oma_ai_ci"
  exit 1
fi

echo "==> migrate + bootstrap ($DATABASE_URL)"
pnpm db:migrate:deploy
pnpm --filter @oma/api bootstrap:platform-owner

PHASE="${1:-all}"

run_format() { pnpm format; }
run_lint() { pnpm lint; }
run_typecheck() { pnpm typecheck; }
run_unit() { pnpm test:unit; }
run_integration() { pnpm test:integration; }
run_contract() { pnpm test:contract; }
run_security() { pnpm test:security; }
run_prisma() { pnpm --filter @oma/db exec prisma validate; }
run_migrate_proof() {
  psql "postgresql://oma@127.0.0.1:5432/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS oma_ai_cert_migrate;"
  psql "postgresql://oma@127.0.0.1:5432/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE oma_ai_cert_migrate OWNER oma;"
  DATABASE_URL='postgresql://oma@127.0.0.1:5432/oma_ai_cert_migrate?schema=public' pnpm --filter @oma/db exec prisma migrate deploy
  psql "postgresql://oma@127.0.0.1:5432/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE oma_ai_cert_migrate;"
}
run_openapi() {
  pnpm openapi:generate
  if ! git diff --quiet -- packages/api-client/openapi.json; then
    echo "OpenAPI diff is dirty after generate"
    git diff --stat -- packages/api-client/openapi.json
    exit 1
  fi
}
run_builds() {
  pnpm --filter @oma/api build
  pnpm --filter @oma/worker build
  # web production build must not run concurrent with playwright/dev
  pnpm --filter @oma/web build
}
run_audit() { pnpm audit:deps; }
run_secret() {
  if rg -n --hidden -g '!.git' -g '!node_modules' -g '!.next' -g '!dist' -g '!pnpm-lock.yaml' -g '!.review' \
    'sk-[a-zA-Z0-9]{20,}|BEGIN (RSA |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16}' .; then
    echo "Secret scan found candidates"
    exit 1
  fi
}
run_diff_check() { git diff --check; }
run_e2e() {
  pnpm exec playwright test
}
run_e2e_queue_twice() {
  pnpm exec playwright test tests/e2e/brand-q-bwi-10-concurrency.e2e.ts tests/e2e/jobs-outbox.e2e.ts --project=en-desktop
  pnpm exec playwright test tests/e2e/brand-q-bwi-10-concurrency.e2e.ts tests/e2e/jobs-outbox.e2e.ts --project=en-desktop
}

case "$PHASE" in
  pre)
    run_format; run_lint; run_typecheck; run_unit; run_integration; run_contract; run_security
    run_prisma; run_migrate_proof; run_openapi; run_audit; run_secret; run_diff_check
    ;;
  builds)
    run_builds
    ;;
  e2e)
    run_e2e
    ;;
  queue)
    run_e2e_queue_twice
    ;;
  all)
    run_format; run_lint; run_typecheck; run_unit; run_integration; run_contract; run_security
    run_prisma; run_migrate_proof; run_openapi; run_audit; run_secret; run_diff_check
    run_builds
    run_e2e
    run_e2e_queue_twice
    ;;
  *)
    echo "Usage: $0 [pre|builds|e2e|queue|all]"
    exit 2
    ;;
esac

echo "CERT_GATE_PHASE_${PHASE}_OK"
