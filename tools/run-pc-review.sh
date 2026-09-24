#!/usr/bin/env bash
set -euo pipefail

: "${GEMINI_API_KEY:?Set GEMINI_API_KEY in this terminal after rotating the exposed key}"
export PORT="${PORT:-8787}"
export GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"
export ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-http://localhost:8080}"

exec node "$(dirname "$0")/pc-review-server.mjs"
