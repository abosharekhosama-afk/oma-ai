#!/usr/bin/env bash
# Stop only the Feature 003 review session started by review-003.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="$ROOT/.review/pids"

stop_one() {
  local name="$1"
  local file="$PID_DIR/${name}.pid"
  if [[ ! -f "$file" ]]; then
    return 0
  fi
  local pid
  pid="$(cat "$file" 2>/dev/null || true)"
  if [[ -z "${pid}" ]]; then
    rm -f "$file"
    return 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$file"
    return 0
  fi
  # Kill process group children carefully: only this pid tree
  pkill -P "$pid" 2>/dev/null || true
  kill "$pid" 2>/dev/null || true
  sleep 0.5
  kill -9 "$pid" 2>/dev/null || true
  rm -f "$file"
  echo "stopped $name (pid $pid)"
}

stop_one api
stop_one worker
stop_one web
echo "Review session stop complete."
