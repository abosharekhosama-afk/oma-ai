#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env in $ROOT"
  echo "Run: cp .env.example .env"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

export MAIL_PROVIDER="${MAIL_PROVIDER:-recording}"
export BRAND_FIXTURE_CONNECTOR="${BRAND_FIXTURE_CONNECTOR:-1}"
export WEB_PORT="${WEB_PORT:-3000}"
export WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:${WEB_PORT}}"
export WEB_ORIGIN="${WEB_ORIGIN:-$WEB_BASE_URL}"

echo "OMA AI local stack"
echo "  Web:    ${WEB_BASE_URL}"
echo "  API:    ${API_PUBLIC_URL:-http://127.0.0.1:3001}"
echo "  Login:  ${WEB_BASE_URL}/login"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

trap 'kill 0' EXIT INT TERM

pnpm dev:api &
pnpm dev:worker &
pnpm dev:web &
wait
