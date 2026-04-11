#!/bin/bash
# ============================================================
#  Bach Dang WAF — Development Quick Start
#  Sets up and launches API + Web for local development.
#  PostgreSQL via Docker (optional) or existing local instance.
#
#  Usage: bash scripts/dev-start.sh
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
# Dev database defaults
# ----------------------------------------------------------
DEV_DB_CONTAINER="waf-database"
DEV_DB_NAME="bach_dang_waf_db"
DEV_DB_USER="bach_dang_waf_user"
DEV_DB_PASS="dev_secret_2024"
DEV_DB_PORT=5432

# ----------------------------------------------------------
# Ports
# ----------------------------------------------------------
API_PORT=3001
WEB_PORT=8080

# ----------------------------------------------------------
# Helpers (no tee — dev mode is interactive)
# ----------------------------------------------------------
nl()   { echo ""; }
line() { printf '%s\n' "$(printf '─%.0s' {1..48})"; }
msg()  { echo "  $*"; }
ok()   { echo "  [ok]  $*"; }
run()  { echo "  [..]  $*"; }
warn() { echo "  [!!]  $*"; }
die()  { echo "  [XX]  $*"; exit 1; }

# Stop process listening on a given port
stop_port() {
    local port="$1" label="$2"
    local pids; pids="$(lsof -ti:"${port}" 2>/dev/null || true)"
    [[ -z "${pids}" ]] && return 0
    for pid in ${pids}; do
        local cmd; cmd="$(ps -p "${pid}" -o comm= 2>/dev/null || true)"
        kill -TERM "${pid}" 2>/dev/null || true
        sleep 1
        kill -0 "${pid}" 2>/dev/null && kill -KILL "${pid}" 2>/dev/null || true
    done
    ok "Stopped ${label} (port ${port})"
}

teardown() {
    nl; msg "Shutting down..."; nl
    stop_port "${API_PORT}" "API backend"
    stop_port "${WEB_PORT}" "Web frontend"
    [[ "${USE_DOCKER_PG}" == "true" ]] && {
        docker stop "${DEV_DB_CONTAINER}" 2>/dev/null \
            && ok "PostgreSQL container stopped" || true
    }
    nl; msg "Bye."; nl
    exit 0
}
trap teardown SIGINT SIGTERM

# ==============================================================
# Banner
# ==============================================================
nl; line
msg " Bach Dang WAF — Development Quick Start"
line; nl

# ==============================================================
# PostgreSQL — Docker or existing
# ==============================================================
USE_DOCKER_PG="false"
DB_URL=""

if command -v docker &>/dev/null; then
    read -r -p "  Use Docker for PostgreSQL? [Y/n]: " _ans
    _ans="${_ans:-y}"
    if [[ "${_ans,,}" != "n" ]]; then
        USE_DOCKER_PG="true"
        run "Starting PostgreSQL ${DEV_DB_CONTAINER}..."
        docker stop "${DEV_DB_CONTAINER}" 2>/dev/null || true
        docker rm   "${DEV_DB_CONTAINER}" 2>/dev/null || true
        docker run -d \
            --name "${DEV_DB_CONTAINER}" \
            -e POSTGRES_DB="${DEV_DB_NAME}" \
            -e POSTGRES_USER="${DEV_DB_USER}" \
            -e POSTGRES_PASSWORD="${DEV_DB_PASS}" \
            -p "${DEV_DB_PORT}":5432 \
            postgres:15-alpine > /dev/null \
            || die "Failed to start PostgreSQL container"
        sleep 3
        ok "PostgreSQL running in Docker"
        DB_URL="postgresql://${DEV_DB_USER}:${DEV_DB_PASS}@localhost:${DEV_DB_PORT}/${DEV_DB_NAME}?schema=public"
    fi
fi

if [[ -z "${DB_URL}" ]]; then
    msg "Enter your PostgreSQL connection URL"
    msg "(default: postgresql://user:password@localhost:5432/bach_dang_waf_db)"
    read -r -p "  DATABASE_URL: " _input_url
    DB_URL="${_input_url:-postgresql://user:password@localhost:5432/bach_dang_waf_db?schema=public}"
fi

# ==============================================================
# Write .env files if missing
# ==============================================================
if [[ ! -f "${WAF_API_DIR}/.env" ]]; then
    run "Creating ${WAF_API_DIR}/.env from .env.example"
    cp "${WAF_API_DIR}/.env.example" "${WAF_API_DIR}/.env"
    sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=\"${DB_URL}\"|g" "${WAF_API_DIR}/.env"
    sed -i.bak "s|CORS_ORIGIN=.*|CORS_ORIGIN=\"http://localhost:${WEB_PORT},http://localhost:5173\"|g" "${WAF_API_DIR}/.env"
    sed -i.bak "s|NODE_ENV=.*|NODE_ENV=development|g" "${WAF_API_DIR}/.env"
    rm -f "${WAF_API_DIR}/.env.bak"
    ok "API .env created"
fi

if [[ ! -f "${WAF_WEB_DIR}/.env" ]]; then
    run "Creating ${WAF_WEB_DIR}/.env from .env.example"
    cp "${WAF_WEB_DIR}/.env.example" "${WAF_WEB_DIR}/.env"
    sed -i.bak "s|VITE_API_URL=.*|VITE_API_URL=http://localhost:${API_PORT}/api|g" "${WAF_WEB_DIR}/.env"
    rm -f "${WAF_WEB_DIR}/.env.bak"
    ok "Web .env created"
fi

# ==============================================================
# Install packages
# ==============================================================
run "Installing packages (pnpm install)"
cd "${WAF_ROOT}" && pnpm install

# ==============================================================
# Database: generate + migrate + seed
# ==============================================================
run "Setting up database"
cd "${WAF_API_DIR}"
pnpm prisma:generate
pnpm exec prisma migrate deploy
pnpm prisma:seed 2>/dev/null && ok "Database seeded" \
    || warn "Seed skipped (data already present)"

# ==============================================================
# Launch API
# ==============================================================
nl; line
run "Starting API backend on port ${API_PORT}..."
cd "${WAF_API_DIR}"
pnpm dev > /tmp/waf-api.log 2>&1 &
API_PID=$!
sleep 2

# ==============================================================
# Launch Web
# ==============================================================
run "Starting Web UI on port ${WEB_PORT}..."
cd "${WAF_WEB_DIR}"
pnpm dev > /tmp/waf-web.log 2>&1 &
WEB_PID=$!
sleep 2

# ==============================================================
# Health check
# ==============================================================
nl
curl -fsS "http://localhost:${API_PORT}/api/health" 2>/dev/null \
    | grep -q "success" \
    && ok "API health check passed" \
    || warn "API health check pending (may still be starting)"

# ==============================================================
# Summary
# ==============================================================
nl; line
msg " Ready"
line; nl
msg " URL"
msg "   Web UI  : http://localhost:${WEB_PORT}"
msg "   API     : http://localhost:${API_PORT}"
nl
msg " Default credentials"
msg "   admin / admin123"
nl
msg " Logs"
msg "   API  : tail -f /tmp/waf-api.log"
msg "   Web  : tail -f /tmp/waf-web.log"
nl
msg " Press Ctrl+C to stop all services"
nl; line; nl

# Wait
wait "${API_PID}" "${WEB_PID}" 2>/dev/null || true
