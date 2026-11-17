#!/usr/bin/env bash
# 005 CHK010 — quick ops smoke (API must be reachable; Worker/Redis optional checks).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3001}"
echo "API_BASE=$API_BASE"

echo "== live =="
curl -sf "${API_BASE}/api/v1/health/live" | head -c 200
echo

echo "== ready =="
curl -sf "${API_BASE}/api/v1/health/ready" | head -c 200
echo

echo "== queues =="
curl -sf "${API_BASE}/api/v1/platform/health/queues" | head -c 800
echo

echo "Done. For CHK011 run a real scan on the worker host and confirm ingestion job consumed < 2 min."