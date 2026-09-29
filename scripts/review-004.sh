#!/usr/bin/env bash
# Local owner-preview launcher for Full Visual Product Certification (Stage 7).
# Isolated DB: oma_ai_visual_cert_004 · Redis DB 3 · binding 127.0.0.1 only.
# VISUAL_ACCEPTANCE remains PENDING_OWNER — prints OWNER_PREVIEW: READY only.
#
# Acceptance / certification must use a clean Next.js production build (`next start`).
# Development: OMA_REVIEW_WEB_MODE=dev pnpm review:004   or   pnpm review:004:dev
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
export WEB_PORT="${WEB_PORT:-3010}"
export API_PORT="${API_PORT:-3011}"
export WORKER_HEALTH_PORT="${WORKER_HEALTH_PORT:-3012}"
export WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:${WEB_PORT}}"
export WEB_ORIGIN="${WEB_ORIGIN:-$WEB_BASE_URL}"
export API_PUBLIC_URL="${API_PUBLIC_URL:-http://127.0.0.1:${API_PORT}}"
# production (default) | dev — acceptance must never use next dev
export OMA_REVIEW_WEB_MODE="${OMA_REVIEW_WEB_MODE:-production}"

# Owner preview must never bind the foreign local apps on 3000/3100.
# Ignore .env WEB_PORT/API_PORT when they point at reserved foreign ports.
case "${WEB_PORT}" in
  3000|3100) WEB_PORT=3010 ;;
esac
case "${API_PORT}" in
  3001) API_PORT=3011 ;;
esac
case "${WORKER_HEALTH_PORT}" in
  3002) WORKER_HEALTH_PORT=3012 ;;
esac

# Dedicated visual certification database (never e2e / never production / never acceptance alias alone)
export DATABASE_URL="${REVIEW_DATABASE_URL:-postgresql://burhanbakri@127.0.0.1:5432/oma_ai_visual_cert_004?schema=public}"
export REDIS_URL="${REVIEW_REDIS_URL:-redis://127.0.0.1:6379/3}"
export BULLMQ_PREFIX="${BULLMQ_PREFIX:-oma-visual-cert-004}"

assert_not_prod() {
  local url="$1"
  if echo "$url" | grep -Eqi 'prod|production|rds\.amazonaws|azure\.com|supabase\.co'; then
    if ! echo "$url" | grep -Eq '127\.0\.0\.1|localhost'; then
      echo "Refusing review launcher against non-local/production DATABASE_URL"
      exit 1
    fi
  fi
  if ! echo "$url" | grep -Eqi 'oma_ai_visual_cert_004'; then
    echo "Refusing review launcher: DATABASE_URL must target oma_ai_visual_cert_004"
    exit 1
  fi
}
assert_not_prod "$DATABASE_URL"

pick_port() {
  local preferred="$1"
  local alt="$2"
  if lsof -nP -iTCP:"$preferred" -sTCP:LISTEN >/dev/null 2>&1; then
    local existing listener
    existing="$(lsof -nP -iTCP:"$preferred" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
    listener="$existing"
    # Reuse preferred only when our recorded pid is the actual listener.
    if [[ -n "${existing}" ]] && [[ -f "$PID_DIR/api.pid" || -f "$PID_DIR/web.pid" || -f "$PID_DIR/worker.pid" ]]; then
      local ours=""
      for name in api web worker; do
        if [[ -f "$PID_DIR/${name}.pid" ]]; then
          ours="$(cat "$PID_DIR/${name}.pid" 2>/dev/null || true)"
          if [[ -n "$ours" && "$ours" == "$listener" ]]; then
            echo "$preferred"
            return
          fi
          # also accept child of recorded pid
          if [[ -n "$ours" ]] && pgrep -P "$ours" 2>/dev/null | grep -qx "$listener"; then
            echo "$preferred"
            return
          fi
        fi
      done
    fi
    echo "$alt"
  else
    echo "$preferred"
  fi
}

SERVED_SHA="$(git rev-parse HEAD)"
export OMA_REVIEW_SERVED_SHA="$SERVED_SHA"

echo "==> OMA AI Full Visual Product Certification owner preview"
echo "    Served SHA: $SERVED_SHA"
echo "    Note:       VISUAL_ACCEPTANCE=PENDING_OWNER · USER_ACCEPTANCE=PENDING"

# Stop previous review listeners before port selection so we never reuse a foreign
# process on preferred ports 3000/3001/3002 (e.g. another local app).
if [[ -f "$ROOT/scripts/review-004-stop.sh" ]]; then
  bash "$ROOT/scripts/review-004-stop.sh" || true
fi
rm -f "$PID_DIR"/*.pid

API_PORT="$(pick_port "$API_PORT" 3011)"
WEB_PORT="$(pick_port "$WEB_PORT" 3010)"
WORKER_HEALTH_PORT="$(pick_port "$WORKER_HEALTH_PORT" 3012)"
export API_PORT WEB_PORT WORKER_HEALTH_PORT
export WEB_BASE_URL="http://127.0.0.1:${WEB_PORT}"
export WEB_ORIGIN="$WEB_BASE_URL"
export API_PUBLIC_URL="http://127.0.0.1:${API_PORT}"

echo "    Web mode:   $OMA_REVIEW_WEB_MODE"
echo "    Database:   $DATABASE_URL"
echo "    Redis:      $REDIS_URL"
echo "    Prefix:     $BULLMQ_PREFIX"
echo "    Ports:      web=${WEB_PORT} api=${API_PORT} worker=${WORKER_HEALTH_PORT}"

psql "postgresql://burhanbakri@127.0.0.1:5432/postgres" -v ON_ERROR_STOP=1 -c \
  "SELECT 1 FROM pg_database WHERE datname='oma_ai_visual_cert_004'" >/dev/null \
  || psql "postgresql://burhanbakri@127.0.0.1:5432/postgres" -c "CREATE DATABASE oma_ai_visual_cert_004;"

redis-cli -n 3 ping >/dev/null

echo "==> Migrations"
pnpm --filter @oma/db exec prisma migrate deploy

echo "==> Review seed (idempotent)"
pnpm --filter @oma/db exec tsx prisma/seed-review-003.ts

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

if [[ "$OMA_REVIEW_WEB_MODE" == "dev" ]]; then
  echo "==> Web: next dev (development only — not for owner acceptance)"
  start_bg web pnpm --filter @oma/web exec next dev -p "$WEB_PORT" -H 127.0.0.1
else
  echo "==> Web: clean production build + next start"
  unset NEXT_DIST_DIR || true
  # Force a real production build even if .env exports NODE_ENV=development
  if [[ "${OMA_REVIEW_SKIP_WEB_BUILD:-0}" != "1" ]]; then
    env NODE_ENV=production pnpm --filter @oma/web exec next build
  else
    echo "    skipping next build (OMA_REVIEW_SKIP_WEB_BUILD=1)"
  fi
  start_bg web env NODE_ENV=production pnpm --filter @oma/web exec next start -p "$WEB_PORT" -H 127.0.0.1
fi

wait_http() {
  local url="$1"
  local label="$2"
  local n=0
  until curl -sf "$url" >/dev/null 2>&1; do
    n=$((n + 1))
    if [[ $n -gt 120 ]]; then
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
echo " OMA_FULL_VISUAL_PRODUCT_PREVIEW: READY"
echo " OWNER_PREVIEW: READY"
echo " WEB_MODE: $OMA_REVIEW_WEB_MODE"
echo " (VISUAL_ACCEPTANCE remains PENDING_OWNER)"
echo " (USER_ACCEPTANCE remains PENDING)"
echo "=============================================="
echo " Web:            $WEB_BASE_URL"
echo " Login:          $WEB_BASE_URL/login"
echo " Start at:       $WEB_BASE_URL/app  (Command Center)"
echo " API health:     $API_PUBLIC_URL/api/v1/health/live"
echo " Worker health:  http://127.0.0.1:${WORKER_HEALTH_PORT}/"
echo " Served SHA:     $SERVED_SHA"
echo " Credentials:    $CRED_FILE"
if [[ -f "$CRED_FILE" ]]; then
  echo ""
  cat "$CRED_FILE"
fi
echo ""
echo " Owner path (6–8 steps):"
echo "  1. Login → Command Center"
echo "  2. Brand Intelligence → one brand workspace"
echo "  3. Campaigns → Organic + Paid → Content calendar"
echo "  4. Requests → Brief → Tasks board"
echo "  5. Deliverable dark review → approve honesty"
echo "  6. Schedule planning preview + Analytics sample"
echo "  7. Team / Activity / Settings integrations (Not connected)"
echo ""
echo " Stop with:  pnpm review:004:stop"
echo " Stack is running in background (PIDs under .review/pids)."
echo "=============================================="
