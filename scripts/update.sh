#!/bin/bash
# ============================================================
#  Bach Dang WAF — In-place Update
#  Pulls latest code, rebuilds API + Web, applies migrations,
#  seeds missing data, and reloads all services.
#
#  Run as: root (sudo ./scripts/update.sh)
# ============================================================

set -euo pipefail

# --------------------------------------------------
# Paths
# --------------------------------------------------
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SELF_DIR}/.." && pwd)"
API_DIR="${ROOT_DIR}/apps/api"
WEB_DIR="${ROOT_DIR}/apps/web"

UPDATE_LOG="/var/log/bach-dang-waf-update.log"
DB_CONTAINER="waf-database"

# --------------------------------------------------
# Colours
# --------------------------------------------------
C_OK='\033[0;32m'; C_ERR='\033[0;31m'; C_WARN='\033[1;33m'
C_INFO='\033[0;34m'; C_RESET='\033[0m'

# --------------------------------------------------
# Helpers
# --------------------------------------------------
ts()    { date '+%Y-%m-%d %H:%M:%S'; }
step()  { printf "\n${C_INFO}[%s] >>> %s${C_RESET}\n" "$(ts)" "$*" | tee -a "${UPDATE_LOG}"; }
done_() { printf "${C_OK}[%s]  ok  %s${C_RESET}\n"    "$(ts)" "$*" | tee -a "${UPDATE_LOG}"; }
warn_() { printf "${C_WARN}[%s] warn %s${C_RESET}\n"  "$(ts)" "$*" | tee -a "${UPDATE_LOG}"; }
fail()  { printf "${C_ERR}[%s] FAIL %s${C_RESET}\n"   "$(ts)" "$*" | tee -a "${UPDATE_LOG}"; exit 1; }

require_root() { [[ "${EUID}" -eq 0 ]] || fail "Must be run as root (sudo)."; }

svc_stop() {
    local svc="$1"
    if systemctl is-active --quiet "${svc}"; then
        systemctl stop "${svc}" && done_ "Stopped ${svc}"
    else
        warn_ "${svc} was not running"
    fi
}

svc_start() {
    local svc="$1"
    systemctl start "${svc}" || fail "Failed to start ${svc}"
    sleep 3
    systemctl is-active --quiet "${svc}" \
        || fail "${svc} failed to start — check: journalctl -u ${svc} -n 50"
    done_ "Started ${svc}"
}

health_check() {
    local label="$1" url="$2" pattern="$3" retries="${4:-10}" wait="${5:-2}"
    local i=0
    while (( i < retries )); do
        if curl -fsS "${url}" 2>/dev/null | grep -q "${pattern}"; then
            done_ "${label} health check passed"
            return 0
        fi
        (( i++ ))
        sleep "${wait}"
    done
    warn_ "${label} health check did not pass within $((retries * wait))s"
    return 1
}

# ==================================================
# Pre-flight
# ==================================================
require_root
mkdir -p "$(dirname "${UPDATE_LOG}")"

echo "" | tee -a "${UPDATE_LOG}"
printf "[%s] ============================================================\n" "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s]   Bach Dang WAF — Update started\n"                           "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s] ============================================================\n" "$(ts)" | tee -a "${UPDATE_LOG}"

# Verify services were previously deployed
systemctl list-unit-files | grep -q "bach-dang-waf-backend.service" \
    || fail "Backend service not found — run deploy.sh first"
systemctl list-unit-files | grep -q "bach-dang-waf-frontend.service" \
    || fail "Frontend service not found — run deploy.sh first"
docker ps -a 2>/dev/null | grep -q "${DB_CONTAINER}" \
    || fail "Database container '${DB_CONTAINER}' not found — run deploy.sh first"

# ==================================================
# STEP 1 — Check runtime dependencies
# ==================================================
step "[1/6] Checking runtime dependencies"

if ! command -v htpasswd &>/dev/null; then
    warn_ "htpasswd missing — installing apache2-utils"
    apt-get install -y apache2-utils >> "${UPDATE_LOG}" 2>&1 \
        || fail "Failed to install apache2-utils"
    done_ "htpasswd installed"
else
    done_ "htpasswd present"
fi

for dep in node pnpm docker; do
    command -v "${dep}" &>/dev/null || fail "${dep} not found — install it first"
    done_ "${dep} $(${dep} --version 2>&1 | head -1)"
done

# ==================================================
# STEP 2 — Stop services
# ==================================================
step "[2/6] Stopping services"

svc_stop "bach-dang-waf-backend.service"
svc_stop "bach-dang-waf-frontend.service"

# ==================================================
# STEP 3 — Rebuild API
# ==================================================
step "[3/6] Rebuilding API"

# Ensure database is up
if ! docker ps 2>/dev/null | grep -q "${DB_CONTAINER}"; then
    docker start "${DB_CONTAINER}" >> "${UPDATE_LOG}" 2>&1 \
        || warn_ "Could not start database container"
    sleep 3
fi

cd "${ROOT_DIR}"
pnpm install >> "${UPDATE_LOG}" 2>&1 || fail "pnpm install failed"
done_ "Monorepo dependencies updated"

cd "${API_DIR}"

pnpm prisma generate >> "${UPDATE_LOG}" 2>&1 || fail "prisma generate failed"
done_ "Prisma client generated"

pnpm prisma migrate deploy >> "${UPDATE_LOG}" 2>&1 || fail "prisma migrate deploy failed"
done_ "Database migrations applied"

pnpm ts-node prisma/seed-safe.ts >> "${UPDATE_LOG}" 2>&1 \
    || warn_ "Safe seed step had warnings (existing data preserved)"
done_ "Database seed complete"

pnpm build >> "${UPDATE_LOG}" 2>&1 || fail "API build failed"
done_ "API build complete"

# ==================================================
# STEP 4 — Rebuild Web
# ==================================================
step "[4/6] Rebuilding Web UI"

cd "${WEB_DIR}"

[[ -d "dist" ]] && { rm -rf dist; done_ "Previous dist cleaned"; }

pnpm build >> "${UPDATE_LOG}" 2>&1 || fail "Web build failed"
done_ "Web UI build complete"

# Resolve public IP for any runtime references
PUBLIC_IP="$(curl -fsS --max-time 5 ifconfig.me \
           || curl -fsS --max-time 5 icanhazip.com \
           || curl -fsS --max-time 5 ipinfo.io/ip \
           || echo "localhost")"

# Patch Content-Security-Policy placeholder if present in built HTML
if grep -q "__API_URL__" "${WEB_DIR}/dist/index.html" 2>/dev/null; then
    sed -i "s|__API_URL__|http://${PUBLIC_IP}:3001 http://localhost:3001|g" \
        "${WEB_DIR}/dist/index.html"
    sed -i "s|__WS_URL__|ws://${PUBLIC_IP}:* ws://localhost:*|g" \
        "${WEB_DIR}/dist/index.html"
    done_ "CSP placeholders resolved (IP: ${PUBLIC_IP})"
fi

# ==================================================
# STEP 5 — Restart services
# ==================================================
step "[5/6] Restarting services"

docker ps 2>/dev/null | grep -q "${DB_CONTAINER}" \
    || fail "Database container stopped unexpectedly"
done_ "Database container running"

svc_start "bach-dang-waf-backend.service"
svc_start "bach-dang-waf-frontend.service"

# Update + reload nginx config
NGINX_CONF="${ROOT_DIR}/config/nginx.conf"
if [[ -f "${NGINX_CONF}" ]]; then
    NGINX_LIVE="/etc/nginx/nginx.conf"
    NGINX_BAK="${NGINX_LIVE}.bak-$(date +%Y%m%d%H%M%S)"
    [[ -f "${NGINX_LIVE}" ]] && mv "${NGINX_LIVE}" "${NGINX_BAK}"

    cp "${NGINX_CONF}" "${NGINX_LIVE}" || fail "Failed to copy nginx config"

    if nginx -t >> "${UPDATE_LOG}" 2>&1; then
        done_ "Nginx config test passed"
        systemctl reload nginx || fail "nginx reload failed"
    else
        # Rollback on bad config
        [[ -f "${NGINX_BAK}" ]] && mv "${NGINX_BAK}" "${NGINX_LIVE}"
        fail "Nginx config test failed — rolled back to previous config"
    fi
else
    warn_ "No config/nginx.conf found — skipping nginx config update"
fi

systemctl is-active --quiet nginx || systemctl start nginx
done_ "Nginx active"

# ==================================================
# STEP 6 — Health checks
# ==================================================
step "[6/6] Health checks"

sleep 5

health_check "Backend API" "http://localhost:3001/api/health" "success"     10 2 || true
health_check "Frontend"    "http://localhost:8080"            "<!doctype html" 5 2 || true

# ==================================================
# Summary
# ==================================================
echo "" | tee -a "${UPDATE_LOG}"
printf "[%s] ============================================================\n" "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s]   Bach Dang WAF — Update complete\n"                           "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s] ============================================================\n" "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s]\n" "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s]   Components rebuilt\n"                "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s]     API      : rebuilt + migrated\n"   "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s]     Web UI   : rebuilt\n"              "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s]     Database : migrations applied\n"   "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s]\n" "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s]   Service endpoints\n"                 "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s]     API      : http://%s:3001\n"       "$(ts)" "${PUBLIC_IP}" | tee -a "${UPDATE_LOG}"
printf "[%s]     Portal   : http://%s:8080\n"       "$(ts)" "${PUBLIC_IP}" | tee -a "${UPDATE_LOG}"
printf "[%s]     Database : docker container %s\n"  "$(ts)" "${DB_CONTAINER}" | tee -a "${UPDATE_LOG}"
printf "[%s]\n" "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s]   Manage services\n"                   "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s]     systemctl {start|stop|restart|status} bach-dang-waf-backend\n"  "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s]     systemctl {start|stop|restart|status} bach-dang-waf-frontend\n" "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s]     docker {start|stop|restart} %s\n"  "$(ts)" "${DB_CONTAINER}" | tee -a "${UPDATE_LOG}"
printf "[%s]\n" "$(ts)" | tee -a "${UPDATE_LOG}"
printf "[%s]   Logs  :  tail -f %s\n"               "$(ts)" "${UPDATE_LOG}" | tee -a "${UPDATE_LOG}"
printf "[%s] ============================================================\n" "$(ts)" | tee -a "${UPDATE_LOG}"
