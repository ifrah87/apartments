#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

existing_next_pids="$(pgrep -f "next dev --webpack" || true)"
if [[ -n "${existing_next_pids}" ]]; then
  echo "Next dev is already running (PID: ${existing_next_pids//$'\n'/, })."
  echo "Use http://localhost:3000 if it is healthy, or run npm run dev:reset."
  exit 0
fi

if [[ -f ".next/dev/lock" ]]; then
  echo "Removing stale Next.js dev lock..."
  rm -f ".next/dev/lock"
fi

exec next dev --webpack
