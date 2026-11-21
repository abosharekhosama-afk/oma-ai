#!/usr/bin/env bash
# 005 CHK010 — ops smoke (API reachable; Worker heartbeat + queue depths).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3001}"
echo "API_BASE=$API_BASE"

fail=0

echo "== live =="
curl -sf "${API_BASE}/api/v1/health/live" | head -c 200
echo

echo "== ready =="
if ! curl -sf "${API_BASE}/api/v1/health/ready" | head -c 200; then
  echo "WARN: ready check failed (DB sleeping or misconfigured)" >&2
  fail=1
fi
echo

echo "== queues =="
queues_json="$(curl -sf "${API_BASE}/api/v1/platform/health/queues")"
echo "$queues_json" | head -c 1200
echo

if command -v jq >/dev/null 2>&1; then
  alive="$(echo "$queues_json" | jq -r '.data.worker_alive // false')"
  age="$(echo "$queues_json" | jq -r '.data.worker_heartbeat_age_seconds // "null"')"
  note="$(echo "$queues_json" | jq -r '.data.note // ""')"
  ingestion_waiting="$(echo "$queues_json" | jq '.data.queues[] | select(.name=="ingestion") | .waiting' 2>/dev/null || echo 0)"
  ingestion_active="$(echo "$queues_json" | jq '.data.queues[] | select(.name=="ingestion") | .active' 2>/dev/null || echo 0)"
  ingestion_failed="$(echo "$queues_json" | jq '.data.queues[] | select(.name=="ingestion") | .failed' 2>/dev/null || echo 0)"

  echo "== interpretation =="
  echo "worker_alive=$alive heartbeat_age_seconds=$age"
  echo "ingestion waiting=$ingestion_waiting active=$ingestion_active failed=$ingestion_failed"
  echo "note: $note"

  if [[ "$alive" != "true" ]]; then
    echo "FAIL: Worker heartbeat missing or stale — start Worker with same REDIS_URL + BULLMQ_PREFIX as API." >&2
    fail=1
  fi
  if [[ "${ingestion_failed:-0}" != "0" ]] && [[ "${ingestion_failed:-0}" != "null" ]]; then
    echo "WARN: ingestion queue has failed jobs — inspect Worker logs and BullMQ failed set." >&2
    fail=1
  fi
else
  echo "Install jq for automated CHK010 interpretation (worker_alive, queue depths)." >&2
fi

echo
if [[ "$fail" -eq 0 ]]; then
  echo "CHK010 partial PASS (API + heartbeat). For full CHK010: enqueue a scan and confirm ingestion active drains within 2 min."
else
  echo "CHK010 partial FAIL — fix issues above before live scan proof (CHK011)." >&2
  exit 1
fi