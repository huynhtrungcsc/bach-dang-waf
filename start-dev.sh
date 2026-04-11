#!/bin/bash
set -euo pipefail

# Development startup — launches backend API and frontend in parallel
# Requires Node.js 22+ (Vite 7 dependency)

NODE22_PATH="/nix/store/s97a21afj6aw098a25gs3j7ias7wzanm-nodejs-22.22.0-wrapped/bin"
export PATH="${NODE22_PATH}:${PATH}"

REPO_ROOT="/home/runner/workspace"

cleanup() {
  echo "Shutting down dev servers..."
  kill 0
}
trap cleanup EXIT

echo "Starting backend API (port 3001)..."
cd "${REPO_ROOT}/apps/api" && pnpm dev &
BACKEND_PID=$!

echo "Starting frontend dev server (port 5000)..."
cd "${REPO_ROOT}/apps/web" && pnpm dev &
FRONTEND_PID=$!

wait "${BACKEND_PID}" "${FRONTEND_PID}"
