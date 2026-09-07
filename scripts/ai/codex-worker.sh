#!/usr/bin/env bash
# Safe Codex CLI wrapper for OMA AI / Development OS orchestration.
# Auth: ChatGPT account via `codex login` — do NOT set API keys here.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"

if ! command -v codex >/dev/null 2>&1; then
  echo "ERROR: codex CLI not found. Install: curl -fsSL https://chatgpt.com/codex/install.sh | sh" >&2
  exit 127
fi

SANDBOX="read-only"
PROMPT=""
EXTRA=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sandbox)
      SANDBOX="${2:-}"
      shift 2
      ;;
    --workspace-write)
      SANDBOX="workspace-write"
      shift
      ;;
    --read-only)
      SANDBOX="read-only"
      shift
      ;;
    --)
      shift
      EXTRA+=("$@")
      break
      ;;
    -*)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 [--sandbox read-only|workspace-write] \"PROMPT\"" >&2
      exit 2
      ;;
    *)
      PROMPT="$1"
      shift
      ;;
  esac
done

if [[ -z "${PROMPT}" ]]; then
  echo "Usage: $0 [--sandbox read-only|workspace-write] \"PROMPT\"" >&2
  exit 2
fi

case "${SANDBOX}" in
  read-only|workspace-write) ;;
  danger-full-access)
    echo "ERROR: danger-full-access is not allowed by this wrapper." >&2
    exit 2
    ;;
  *)
    echo "ERROR: invalid sandbox '${SANDBOX}'" >&2
    exit 2
    ;;
esac

# Refuse if not ChatGPT-authenticated (do not fall back to API key silently).
STATUS_OUT="$(codex login status 2>&1 || true)"
if ! printf '%s\n' "${STATUS_OUT}" | grep -qiE 'logged in|chatgpt|Logged in'; then
  if printf '%s\n' "${STATUS_OUT}" | grep -qi 'Not logged in'; then
    echo "ERROR: Codex not logged in. Run: codex login  →  Sign in with ChatGPT" >&2
    exit 1
  fi
fi

cd "${ROOT}"
# Never inherit a pipe/TTY that makes Codex wait for extra stdin when a prompt is already provided.
exec codex exec \
  -C "${ROOT}" \
  -s "${SANDBOX}" \
  --ephemeral \
  "${PROMPT}" \
  "${EXTRA[@]+"${EXTRA[@]}"}" \
  </dev/null
