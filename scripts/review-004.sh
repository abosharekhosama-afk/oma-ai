#!/usr/bin/env bash
# Local owner-preview launcher for Complete Product Demo.
# Isolated DB: oma_ai_acceptance · Redis DB 2 · binding 127.0.0.1 only.
# USER_ACCEPTANCE remains PENDING — this prints OMA_FULL_PRODUCT_PREVIEW: READY only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PID_DIR="$ROOT/.review/pids"
LOG_DIR="$ROOT/.review/logs"
CRED_FILE="$ROOT/.review/004-credentials.txt"
mkdir -p "$PID_DIR" "$LOG_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example first."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

export NODE_ENV="${NODE_ENV:-development}"
export OMA_ENV="${OMA_ENV:-development}"
export MAIL_PROVIDER="${MAIL_PROVIDER:-recording}"
export BRAND_FIXTURE_CONNECTOR="${BRAND_FIXTURE_CONNECTOR:-1}"
export OMA_DEMO_MODE="${OMA_DEMO_MODE:-1}"
export WEB_PORT="${WEB_PORT:-3000}"
export API_PORT="${API_PORT:-3001}"
export WORKER_HEALTH_PORT="${WORKER_HEALTH_PORT:-3002}"
export WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:${WEB_PORT}}"
export WEB_ORIGIN="${WEB_ORIGIN:-$WEB_BASE_URL}"
export API_PUBLIC_URL="${API_PUBLIC_URL:-http://127.0.0.1:${API_PORT}}"

# Dedicated review database (never e2e / never production)
export DATABASE_URL="${REVIEW_DATABASE_URL:-postgresql://burhanbakri@127.0.0.1:5432/oma_ai_acceptance?schema=public}"
export REDIS_URL="${REVIEW_REDIS_URL:-redis://127.0.0.1:6379/2}"
export BULLMQ_PREFIX="${BULLMQ_PREFIX:-oma-review-004}"

assert_not_prod() {
  local url="$1"
  if echo "$url" | grep -Eqi 'prod|production|rds\.amazonaws|azure\.com|supabase\.co'; then
    if ! echo "$url" | grep -Eq '127\.0\.0\.1|localhost'; then
      echo "Refusing review launcher against non-local/production DATABASE_URL"
      exit 1
    fi
  fi
  if ! echo "$url" | grep -Eqi 'oma_ai_acceptance'; then
    echo "Refusing review launcher: DATABASE_URL must target oma_ai_acceptance"
    exit 1
  fi
}
assert_not_prod "$DATABASE_URL"

pick_port() {
  local preferred="$1"
  local alt="$2"
  if lsof -nP -iTCP:"$preferred" -sTCP:LISTEN >/dev/null 2>&1; then
    # Only reclaim if our previous review pid owns it
    local existing
    existing="$(lsof -nP -iTCP:"$preferred" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
    if [[ -n "${existing}" ]] && [[ -f "$PID_DIR/api.pid" || -f "$PID_DIR/web.pid" || -f "$PID_DIR/worker.pid" ]]; then
      echo "$preferred"
      return
    fi
    echo "$alt"
  else
    echo "$preferred"
  fi
}

API_PORT="$(pick_port "$API_PORT" 3011)"
WEB_PORT="$(pick_port "$WEB_PORT" 3010)"
WORKER_HEALTH_PORT="$(pick_port "$WORKER_HEALTH_PORT" 3012)"
export API_PORT WEB_PORT WORKER_HEALTH_PORT
export WEB_BASE_URL="http://127.0.0.1:${WEB_PORT}"
export WEB_ORIGIN="$WEB_BASE_URL"
export API_PUBLIC_URL="http://127.0.0.1:${API_PORT}"

SERVED_SHA="$(git rev-parse HEAD)"
export OMA_REVIEW_SERVED_SHA="$SERVED_SHA"

echo "==> OMA AI Complete Product Demo owner preview launcher"
echo "    Served SHA: $SERVED_SHA"
echo "    Database:   $DATABASE_URL"
echo "    Redis:      $REDIS_URL"
echo "    Prefix:     $BULLMQ_PREFIX"
echo "    Note:       USER_ACCEPTANCE remains PENDING"

# Stop only prior review session PIDs
if [[ -f "$ROOT/scripts/review-004-stop.sh" ]]; then
  bash "$ROOT/scripts/review-004-stop.sh" || true
fi

# Ensure DB exists
psql "postgresql://burhanbakri@127.0.0.1:5432/postgres" -v ON_ERROR_STOP=1 -c \
  "SELECT 1 FROM pg_database WHERE datname='oma_ai_acceptance'" >/dev/null \
  || psql "postgresql://burhanbakri@127.0.0.1:5432/postgres" -c "CREATE DATABASE oma_ai_acceptance;"

redis-cli -n 2 ping >/dev/null

echo "==> Migrations"
pnpm --filter @oma/db exec prisma migrate deploy

echo "==> Review seed (idempotent)"
pnpm --filter @oma/db exec tsx prisma/seed-review-003.ts

# Alias credentials for complete-demo preview (Owner-only)
cp -f "$ROOT/.review/003-credentials.json" "$ROOT/.review/004-credentials.json" 2>/dev/null || true
cp -f "$ROOT/.review/003-credentials.txt" "$ROOT/.review/004-credentials.txt" 2>/dev/null || true
if [[ -f "$ROOT/.review/004-credentials.txt" ]]; then
  CRED_FILE="$ROOT/.review/004-credentials.txt"
fi

start_bg() {
  local name="$1"
  shift
  local log="$LOG_DIR/${name}.log"
  echo "==> Starting $name"
  nohup "$@" >"$log" 2>&1 &
  echo $! >"$PID_DIR/${name}.pid"
}

start_bg api pnpm --filter @oma/api exec tsx src/main.ts
start_bg worker env MAIL_PROVIDER=recording pnpm --filter @oma/worker exec tsx src/main.ts
start_bg web pnpm --filter @oma/web exec next dev -p "$WEB_PORT" -H 127.0.0.1

wait_http() {
  local url="$1"
  local label="$2"
  local n=0
  until curl -sf "$url" >/dev/null 2>&1; do
    n=$((n + 1))
    if [[ $n -gt 90 ]]; then
      echo "Timeout waiting for $label ($url)"
      echo "See $LOG_DIR"
      exit 1
    fi
    sleep 1
  done
  echo "    ready: $label"
}

wait_http "${API_PUBLIC_URL}/api/v1/health/live" "API live"
wait_http "http://127.0.0.1:${WORKER_HEALTH_PORT}/" "Worker health"
wait_http "${WEB_BASE_URL}" "Web"

echo ""
echo "=============================================="
echo " OMA_FULL_PRODUCT_PREVIEW: READY"
echo " (USER_ACCEPTANCE remains PENDING)"
echo "=============================================="
echo " Web:            $WEB_BASE_URL"
echo " Login:          $WEB_BASE_URL/login"
echo " API health:     $API_PUBLIC_URL/api/v1/health/live"
echo " Worker health:  http://127.0.0.1:${WORKER_HEALTH_PORT}/"
echo " Served SHA:     $SERVED_SHA"
echo " Credentials:    $CRED_FILE"
if [[ -f "$CRED_FILE" ]]; then
  echo ""
  cat "$CRED_FILE"
fi
echo ""
echo " Stop with:  pnpm review:004:stop"
echo " Stack is running in background (PIDs under .review/pids)."
echo "=============================================="
