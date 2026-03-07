#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Stopping stale Next.js dev processes..."
pkill -f "next dev --webpack" 2>/dev/null || true
pkill -f "next-server (v" 2>/dev/null || true

echo "Clearing dev lock/cache..."
rm -rf ".next/dev"

echo "Starting clean dev server..."
exec next dev --webpack
