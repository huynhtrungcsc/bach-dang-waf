#!/bin/bash
# ============================================================
#  Bach Dang WAF — Container Entrypoint
#  Starts Nginx (daemon off in background) then hands over
#  to the Node.js API process in the foreground.
# ============================================================

set -euo pipefail

LOG_PREFIX="[waf-entrypoint]"

log()  { echo "${LOG_PREFIX} $*"; }
fail() { echo "${LOG_PREFIX} FATAL: $*" >&2; exit 1; }

# ----------------------------------------------------------
# 1. Verify runtime binaries
# ----------------------------------------------------------
command -v nginx >/dev/null 2>&1 || fail "nginx not found in PATH"
command -v node  >/dev/null 2>&1 || fail "node not found in PATH"

# ----------------------------------------------------------
# 2. Clean up stale PID file (left by unclean shutdown)
# ----------------------------------------------------------
WAF_NGINX_PID="/var/run/nginx.pid"
if [[ -f "${WAF_NGINX_PID}" ]]; then
    log "Removing stale nginx PID file"
    rm -f "${WAF_NGINX_PID}"
fi

# ----------------------------------------------------------
# 3. Validate nginx config before starting
# ----------------------------------------------------------
log "Validating nginx configuration..."
nginx -t 2>&1 || fail "nginx configuration test failed"

# ----------------------------------------------------------
# 4. Start nginx in the background
# ----------------------------------------------------------
log "Starting nginx..."
nginx -g "daemon off;" &
WAF_NGINX_BG_PID=$!

sleep 1
kill -0 "${WAF_NGINX_BG_PID}" 2>/dev/null \
    || fail "nginx exited immediately — check error log"
log "nginx PID ${WAF_NGINX_BG_PID} running"

# ----------------------------------------------------------
# 5. Hand over to API (foreground — Docker tracks this PID)
# ----------------------------------------------------------
WAF_API_ENTRY="/app/apps/api/dist/index.js"
[[ -f "${WAF_API_ENTRY}" ]] || fail "API entry not found: ${WAF_API_ENTRY}"

log "Starting API: node ${WAF_API_ENTRY}"
exec node "${WAF_API_ENTRY}"
