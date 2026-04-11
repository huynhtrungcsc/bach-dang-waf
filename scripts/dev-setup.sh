#!/bin/bash
# ============================================================
#  Bach Dang WAF — Development Setup & Launcher
#  One-shot: install packages, run migrations, seed data,
#  then launch API and Web in dev mode.
#
#  Designed for Replit and similar single-terminal environments
#  where the database is already running on the host.
#
#  Usage: bash scripts/dev-setup.sh
# ============================================================

set -euo pipefail

# ----------------------------------------------------------
# Paths
# ----------------------------------------------------------
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WAF_ROOT="$(cd "${SELF}/.." && pwd)"
WAF_API_DIR="${WAF_ROOT}/apps/api"
WAF_WEB_DIR="${WAF_ROOT}/apps/web"

# ----------------------------------------------------------
# Ports used in dev
# ----------------------------------------------------------
API_PORT=3001
WEB_PORT=8080

# ----------------------------------------------------------
# Helpers
# ----------------------------------------------------------
line() { printf '%s\n' "$(printf '─%.0s' {1..48})"; }
msg()  { printf '  %s\n' "$*"; }
ok()   { printf '  [ok]  %s\n' "$*"; }
run()  { printf '  [..]  %s\n' "$*"; }
warn() { printf '  [!!]  %s\n' "$*" >&2; }
die()  { printf '  [XX]  %s\n' "$*" >&2; exit 1; }

stop_port() {
    local port="$1"
    local pids; pids="$(lsof -ti:"${port}" 2>/dev/null || true)"
    [[ -z "${pids}" ]] && return 0
    for pid in ${pids}; do
        kill -TERM "${pid}" 2>/dev/null || true
        sleep 1
        kill -0 "${pid}" 2>/dev/null && kill -KILL "${pid}" 2>/dev/null || true
    done
}

teardown() {
    echo ""
    msg "Stopping services..."
    stop_port "${API_PORT}"
    stop_port "${WEB_PORT}"
    msg "Done."
    exit 0
}
trap teardown SIGINT SIGTERM

# ==============================================================
# Pre-flight
# ==============================================================
[[ -d "${WAF_API_DIR}" ]] || die "apps/api not found at ${WAF_API_DIR}"
[[ -d "${WAF_WEB_DIR}" ]] || die "apps/web not found at ${WAF_WEB_DIR}"

command -v pnpm &>/dev/null || die "pnpm not found — run: npm install -g pnpm@8.15.0"

# ==============================================================
# Banner
# ==============================================================
echo ""; line
msg " Bach Dang WAF — Dev Setup"
line; echo ""

# ==============================================================
# Packages
# ==============================================================
run "Installing packages"
cd "${WAF_ROOT}" && pnpm install
ok "Packages installed"

# ==============================================================
# Database setup
# ==============================================================
echo ""; run "Generating Prisma client"
cd "${WAF_API_DIR}"
pnpm prisma:generate
ok "Prisma client generated"

run "Running migrations"
pnpm exec prisma migrate deploy
ok "Migrations applied"

run "Seeding database"
pnpm prisma:seed 2>/dev/null \
    && ok "Database seeded" \
    || warn "Seed skipped (data may already exist)"

# ==============================================================
# Credentials reminder
# ==============================================================
echo ""; line
msg " Test accounts"
line
msg "  Admin    — admin / admin123"
msg "  Operator — operator / operator123"
msg "  Viewer   — viewer / viewer123"
echo ""; line; echo ""

# ==============================================================
# Launch services
# ==============================================================
run "Starting API on port ${API_PORT}"
cd "${WAF_API_DIR}"
pnpm dev &
API_PID=$!

sleep 3

run "Starting Web UI on port ${WEB_PORT}"
cd "${WAF_WEB_DIR}"
pnpm dev &
WEB_PID=$!

echo ""
ok "All services started"
echo ""; line
msg " API  :  http://localhost:${API_PORT}"
msg " Web  :  http://localhost:${WEB_PORT}"
echo ""; line
msg " Press Ctrl+C to stop"
echo ""

wait "${API_PID}" "${WEB_PID}" 2>/dev/null || true
