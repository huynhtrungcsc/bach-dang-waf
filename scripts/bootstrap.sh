#!/bin/bash
# ============================================================
#  Bach Dang WAF — Production Bootstrap
#  Full first-time deployment: runtime deps, database,
#  Nginx+ModSecurity, API build, Web build, systemd services.
#
#  Usage: sudo bash scripts/bootstrap.sh
#         curl -fsSL <raw-url>/bootstrap.sh | sudo bash
# ============================================================

set -euo pipefail

# ----------------------------------------------------------
# Project constants
# ----------------------------------------------------------
WAF_REPO="https://github.com/huynhtrungcsc/bach-dang-waf.git"
WAF_INSTALL_ROOT="/opt/bach-dang-waf"

# ----------------------------------------------------------
# Runtime paths (resolved after repo detection)
# ----------------------------------------------------------
_ORIGIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
WAF_DEPLOY_LOG="/tmp/waf-bootstrap.log"   # tmp until root confirmed

# ----------------------------------------------------------
# Colour palette
# ----------------------------------------------------------
_R='\033[0;31m' _G='\033[0;32m' _Y='\033[1;33m'
_C='\033[0;36m' _D='\033[2m'    _B='\033[1m' _0='\033[0m'

# ----------------------------------------------------------
# Output helpers
# ----------------------------------------------------------
_ts()      { date '+%Y-%m-%d %H:%M:%S'; }
say_ok()   { printf "  ${_G}[  ok  ]${_0}  %s\n"   "$*" | tee -a "${WAF_DEPLOY_LOG}"; }
say_run()  { printf "  ${_C}[  >>  ]${_0}  %s\n"   "$*" | tee -a "${WAF_DEPLOY_LOG}"; }
say_warn() { printf "  ${_Y}[ warn ]${_0}  %s\n"   "$*" | tee -a "${WAF_DEPLOY_LOG}"; }
say_fail() { printf "  ${_R}[ FAIL ]${_0}  %s\n"   "$*" | tee -a "${WAF_DEPLOY_LOG}"; exit 1; }
say_note() { printf "  ${_D}[  --  ]${_0}  %s\n"   "$*" | tee -a "${WAF_DEPLOY_LOG}"; }

phase() {
    local num="$1" title="$2"
    printf "\n  ${_B}${_C}┌─ Phase %s ── %s${_0}\n  ${_C}│${_0}\n" \
        "${num}" "${title}" | tee -a "${WAF_DEPLOY_LOG}"
}
end_phase() {
    printf "  ${_C}└%s${_0}\n" "$(printf '─%.0s' {1..55})" \
        | tee -a "${WAF_DEPLOY_LOG}"
}

require_root() {
    [[ "${EUID}" -eq 0 ]] || say_fail "Run as root  (sudo bash $0)"
}

# ----------------------------------------------------------
# Repo detection — supports pipe install
# ----------------------------------------------------------
resolve_dirs() {
    if [[ -z "${_ORIGIN}" ]] \
        || [[ "${_ORIGIN}" == "/" ]] \
        || [[ ! -f "${_ORIGIN}/build-engine.sh" ]]; then
        say_run "Pipe mode — cloning repo from GitHub..."
        if command -v git &>/dev/null; then
            if [[ -d "${WAF_INSTALL_ROOT}/.git" ]]; then
                git -C "${WAF_INSTALL_ROOT}" pull origin main --ff-only \
                    >> "${WAF_DEPLOY_LOG}" 2>&1 || true
                say_ok "Repository refreshed at ${WAF_INSTALL_ROOT}"
            else
                rm -rf "${WAF_INSTALL_ROOT}"
                git clone --depth=1 "${WAF_REPO}" "${WAF_INSTALL_ROOT}" \
                    >> "${WAF_DEPLOY_LOG}" 2>&1
                say_ok "Repository cloned to ${WAF_INSTALL_ROOT}"
            fi
        else
            say_run "Installing git first..."
            apt-get update -qq && apt-get install -y -qq git \
                >> "${WAF_DEPLOY_LOG}" 2>&1
            git clone --depth=1 "${WAF_REPO}" "${WAF_INSTALL_ROOT}" \
                >> "${WAF_DEPLOY_LOG}" 2>&1
            say_ok "Repository cloned to ${WAF_INSTALL_ROOT}"
        fi
        WAF_SCRIPT_DIR="${WAF_INSTALL_ROOT}/scripts"
        WAF_ROOT="${WAF_INSTALL_ROOT}"
    else
        WAF_SCRIPT_DIR="${_ORIGIN}"
        WAF_ROOT="$(cd "${_ORIGIN}/.." && pwd)"
    fi

    WAF_API_DIR="${WAF_ROOT}/apps/api"
    WAF_WEB_DIR="${WAF_ROOT}/apps/web"
}

# ----------------------------------------------------------
# Random secret generator
# ----------------------------------------------------------
gen_secret() { openssl rand -base64 64 | tr -d "=+/" | cut -c1-"${1:-64}"; }

# ----------------------------------------------------------
# Banner
# ----------------------------------------------------------
print_banner() {
    clear
    printf "\n${_B}${_C}"
    echo "  ██████╗  █████╗  ██████╗██╗  ██╗    ██████╗  █████╗ ███╗   ██╗ ██████╗"
    echo "  ██╔══██╗██╔══██╗██╔════╝██║  ██║    ██╔══██╗██╔══██╗████╗  ██║██╔════╝"
    echo "  ██████╔╝███████║██║     ███████║    ██║  ██║███████║██╔██╗ ██║██║  ███╗"
    echo "  ██╔══██╗██╔══██║██║     ██╔══██║    ██║  ██║██╔══██║██║╚██╗██║██║   ██║"
    echo "  ██████╔╝██║  ██║╚██████╗██║  ██║    ██████╔╝██║  ██║██║ ╚████║╚██████╔╝"
    echo "  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝"
    printf "${_0}\n"
    printf "  ${_D}Web Application Firewall — Production Bootstrap${_0}\n"
    printf "  ${_D}Nginx + ModSecurity · OWASP CRS · Self-hosted${_0}\n\n"
    printf "  ${_D}%s${_0}\n\n" "$(printf '─%.0s' {1..58})"
}

# ==============================================================
# PHASE 1 — Runtime prerequisites
# ==============================================================
phase_prerequisites() {
    phase "1/8" "Runtime Prerequisites"

    # Node.js
    local required_node=18
    if command -v node &>/dev/null; then
        local ver; ver=$(node -v | sed 's/v//' | cut -d. -f1)
        if (( ver < required_node )); then
            say_run "Node.js ${ver} is below minimum ${required_node} — upgrading to 20.x"
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
                >> "${WAF_DEPLOY_LOG}" 2>&1
            apt-get install -y nodejs >> "${WAF_DEPLOY_LOG}" 2>&1 \
                || say_fail "Node.js upgrade failed"
        fi
    else
        say_run "Node.js not found — installing 20.x"
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
            >> "${WAF_DEPLOY_LOG}" 2>&1
        apt-get install -y nodejs >> "${WAF_DEPLOY_LOG}" 2>&1 \
            || say_fail "Node.js install failed"
    fi
    say_ok "Node.js $(node -v)"

    # htpasswd (apache2-utils)
    if ! command -v htpasswd &>/dev/null; then
        say_run "Installing apache2-utils (htpasswd)"
        apt-get install -y apache2-utils >> "${WAF_DEPLOY_LOG}" 2>&1 \
            || say_fail "Failed to install apache2-utils"
    fi
    say_ok "htpasswd present"

    # pnpm
    if ! command -v pnpm &>/dev/null; then
        say_run "Installing pnpm 8.15.0"
        npm install -g pnpm@8.15.0 >> "${WAF_DEPLOY_LOG}" 2>&1 \
            || say_fail "pnpm install failed"
    else
        local pver; pver=$(pnpm -v | cut -d. -f1)
        if (( pver < 8 )); then
            say_run "pnpm ${pver} outdated — upgrading to 8.15.0"
            npm install -g pnpm@8.15.0 >> "${WAF_DEPLOY_LOG}" 2>&1
        fi
    fi
    say_ok "pnpm $(pnpm -v)"

    # Docker
    if ! command -v docker &>/dev/null; then
        say_run "Docker not found — installing via get.docker.com"
        curl -fsSL https://get.docker.com | sh >> "${WAF_DEPLOY_LOG}" 2>&1 \
            || say_fail "Docker install failed"
        systemctl enable docker >> "${WAF_DEPLOY_LOG}" 2>&1
        systemctl start  docker >> "${WAF_DEPLOY_LOG}" 2>&1
    fi
    say_ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo 'ok')"

    end_phase
}

# ==============================================================
# PHASE 2 — PostgreSQL (Docker container)
# ==============================================================
phase_database() {
    phase "2/8" "PostgreSQL Database"

    local net="waf-net" vol="waf-pgdata"

    docker network ls | grep -q "${net}" \
        || docker network create "${net}" >> "${WAF_DEPLOY_LOG}" 2>&1
    say_ok "Docker network ${net}"

    # Fresh container for clean install
    docker ps -a | grep -q "${WAF_DB_CONTAINER}" && {
        say_run "Removing existing container ${WAF_DB_CONTAINER}"
        docker stop "${WAF_DB_CONTAINER}" >> "${WAF_DEPLOY_LOG}" 2>&1 || true
        docker rm   "${WAF_DB_CONTAINER}" >> "${WAF_DEPLOY_LOG}" 2>&1 || true
    }
    docker volume ls | grep -q "${vol}" && {
        say_run "Removing old data volume (clean install)"
        docker volume rm "${vol}" >> "${WAF_DEPLOY_LOG}" 2>&1 || true
    }

    say_run "Starting PostgreSQL 15-alpine"
    docker run -d \
        --name "${WAF_DB_CONTAINER}" \
        --network "${net}" \
        --restart unless-stopped \
        -e POSTGRES_DB="${WAF_DB_NAME}" \
        -e POSTGRES_USER="${WAF_DB_USER}" \
        -e POSTGRES_PASSWORD="${WAF_DB_PASS}" \
        -p 127.0.0.1:"${WAF_DB_PORT}":5432 \
        -v "${vol}:/var/lib/postgresql/data" \
        postgres:15-alpine >> "${WAF_DEPLOY_LOG}" 2>&1 \
        || say_fail "Failed to start PostgreSQL container"

    say_run "Waiting for database to accept connections..."
    local i=0
    while (( i < 30 )); do
        docker exec "${WAF_DB_CONTAINER}" \
            pg_isready -U "${WAF_DB_USER}" >/dev/null 2>&1 && break
        (( i++ )); sleep 1
        [[ "${i}" -eq 30 ]] && say_fail "PostgreSQL timed out"
    done

    say_ok "PostgreSQL ready"
    say_note "DB:    ${WAF_DB_NAME}  User: ${WAF_DB_USER}  Port: ${WAF_DB_PORT} (localhost)"
    end_phase
}

# ==============================================================
# PHASE 3 — Nginx + ModSecurity (source build)
# ==============================================================
phase_engine() {
    phase "3/8" "Nginx + ModSecurity Engine"

    if command -v nginx &>/dev/null; then
        say_ok "Nginx already installed ($(nginx -v 2>&1 | cut -d/ -f2))"
    else
        say_run "Compiling Nginx + ModSecurity from source (~5 min)"
        bash "${WAF_SCRIPT_DIR}/build-engine.sh" >> "${WAF_DEPLOY_LOG}" 2>&1 \
            || say_fail "Nginx/ModSecurity build failed"
        say_ok "Nginx + ModSecurity installed"
    fi
    end_phase
}

# ==============================================================
# PHASE 4 — Backend setup (deps + migrations + build)
# ==============================================================
phase_api() {
    phase "4/8" "API — Build and Database Setup"

    cd "${WAF_ROOT}"
    [[ -d "node_modules" ]] || {
        say_run "Installing monorepo packages (pnpm install)"
        pnpm install >> "${WAF_DEPLOY_LOG}" 2>&1 \
            || say_fail "pnpm install failed"
    }
    say_ok "Monorepo packages ready"

    cd "${WAF_API_DIR}"

    say_run "Writing .env"
    cat > ".env" << ENVEOF
# ── Bach Dang WAF — API environment ─────────────────────────
DATABASE_URL="postgresql://${WAF_DB_USER}:${WAF_DB_PASS}@localhost:${WAF_DB_PORT}/${WAF_DB_NAME}?schema=public"

PORT=3001
NODE_ENV=production

JWT_ACCESS_SECRET="${WAF_JWT_ACCESS}"
JWT_REFRESH_SECRET="${WAF_JWT_REFRESH}"
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN="http://${WAF_LAN_IP}:8080,http://${WAF_PUBLIC_IP}:8080,http://localhost:8080,http://localhost"

BCRYPT_ROUNDS=10
SESSION_SECRET="${WAF_SESSION_KEY}"

TOTP_ISSUER="Bach Dang WAF"
SSL_STORE_DIR="/etc/nginx/ssl"
ACME_WEBROOT="/var/www/html/.well-known/acme-challenge"

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=change-before-use
ENVEOF
    say_ok "Environment file written"
    say_note "CORS: ${WAF_LAN_IP}:8080  ${WAF_PUBLIC_IP}:8080  localhost"

    say_run "Generating Prisma client"
    pnpm prisma:generate >> "${WAF_DEPLOY_LOG}" 2>&1 \
        || say_fail "prisma generate failed"
    say_ok "Prisma client generated"

    say_run "Running database migrations"
    pnpm exec prisma migrate deploy >> "${WAF_DEPLOY_LOG}" 2>&1 \
        || say_fail "prisma migrate deploy failed"
    say_ok "Migrations applied"

    say_run "Seeding initial data"
    rm -f .seeded
    pnpm prisma:seed >> "${WAF_DEPLOY_LOG}" 2>&1 \
        || say_warn "Seed returned warnings (non-fatal)"
    touch .seeded

    say_run "Compiling TypeScript"
    cd "${WAF_ROOT}"
    pnpm --filter @bach-dang-waf/api build >> "${WAF_DEPLOY_LOG}" 2>&1 \
        || say_fail "API TypeScript build failed"
    say_ok "API compiled"
    end_phase
}

# ==============================================================
# PHASE 5 — Web UI build
# ==============================================================
phase_web() {
    phase "5/8" "Web UI — React Build"

    [[ -d "${WAF_WEB_DIR}/dist" ]] && rm -rf "${WAF_WEB_DIR}/dist"

    say_run "Bundling React application"
    cd "${WAF_ROOT}"
    pnpm --filter @bach-dang-waf/web build >> "${WAF_DEPLOY_LOG}" 2>&1 \
        || say_fail "Web build failed"
    say_ok "Web UI bundled (relative /api paths — IP-agnostic)"
    end_phase
}

# ==============================================================
# PHASE 6 — Nginx configuration
# ==============================================================
phase_nginx_config() {
    phase "6/8" "Nginx — Management Console Config"

    # Directory layout
    for d in /etc/nginx/{ssl,conf.d,snippets,streams-enabled,streams-available}; do
        mkdir -p "${d}"
    done
    mkdir -p /var/www/html/.well-known/acme-challenge
    chmod -R 755 /var/www/html/.well-known
    touch /etc/nginx/conf.d/acl-rules.conf

    # ACME challenge snippet
    cat > /etc/nginx/snippets/acme-challenge.conf << 'ACMEOF'
location ^~ /.well-known/acme-challenge/ {
    default_type "text/plain";
    root /var/www/html;
    allow all;
}
location = /.well-known/acme-challenge/ { return 404; }
ACMEOF
    say_ok "ACME challenge snippet written"

    # Management console vhost (port 8080)
    cat > /etc/nginx/conf.d/waf-console.conf << VHEOF
# Bach Dang WAF — Management Console  (port 8080)
server {
    listen 8080;
    server_name _;

    root ${WAF_WEB_DIR}/dist;
    index index.html;

    location /api/ {
        proxy_pass          http://127.0.0.1:3001/api/;
        proxy_http_version  1.1;
        proxy_set_header    Host              localhost;
        proxy_set_header    X-Real-IP         \$remote_addr;
        proxy_set_header    X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto \$scheme;
        proxy_set_header    Origin            http://localhost:8080;
        proxy_read_timeout  300s;
        proxy_send_timeout  300s;
        proxy_connect_timeout 10s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json
               application/javascript text/xml application/xml;
}
VHEOF
    say_ok "Console vhost written (port 8080)"
    end_phase
}

# ==============================================================
# PHASE 7 — Systemd services
# ==============================================================
phase_services() {
    phase "7/8" "Systemd Services"

    cat > /etc/systemd/system/bach-dang-waf-backend.service << SVCEOF
[Unit]
Description=Bach Dang WAF — API Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${WAF_API_DIR}
Environment=NODE_ENV=production
ExecStart=$(command -v node) dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/bach-dang-waf-backend.log
StandardError=append:/var/log/bach-dang-waf-backend-error.log

[Install]
WantedBy=multi-user.target
SVCEOF

    systemctl daemon-reload
    systemctl enable bach-dang-waf-backend.service >> "${WAF_DEPLOY_LOG}" 2>&1
    say_ok "bach-dang-waf-backend service registered"
    end_phase
}

# ==============================================================
# PHASE 8 — Start everything
# ==============================================================
phase_start() {
    phase "8/8" "Start Services"

    # Backend
    say_run "Starting API backend"
    systemctl restart bach-dang-waf-backend.service \
        || say_fail "Failed to start backend service"
    sleep 2
    systemctl is-active --quiet bach-dang-waf-backend.service \
        || say_fail "Backend failed — check: journalctl -u bach-dang-waf-backend -n 50"
    say_ok "Backend service active"

    # Nginx — apply project config
    nginx -t 2>&1 | grep -q "Address family not supported" && {
        sed -i 's/listen \[::\]:80/# listen [::]:80/g' \
            /etc/nginx/sites-available/default 2>/dev/null || true
    }

    systemctl is-active --quiet nginx || systemctl start nginx

    if [[ -f "${WAF_ROOT}/config/nginx.conf" ]]; then
        local bak="/etc/nginx/nginx.conf.bak-$(date +%Y%m%d%H%M%S)"
        cp /etc/nginx/nginx.conf "${bak}" 2>/dev/null || true
        cp "${WAF_ROOT}/config/nginx.conf" /etc/nginx/nginx.conf \
            || say_fail "Could not copy config/nginx.conf"

        if nginx -t >> "${WAF_DEPLOY_LOG}" 2>&1; then
            say_ok "Nginx config valid"
            systemctl reload nginx >> "${WAF_DEPLOY_LOG}" 2>&1 \
                || systemctl restart nginx >> "${WAF_DEPLOY_LOG}" 2>&1
        else
            say_warn "Nginx config invalid — reverting backup"
            cp "${bak}" /etc/nginx/nginx.conf
        fi
    fi
    say_ok "Nginx active"

    # Firewall
    if command -v ufw &>/dev/null; then
        say_run "Configuring UFW"
        ufw --force reset       >> "${WAF_DEPLOY_LOG}" 2>&1
        ufw default deny incoming >> "${WAF_DEPLOY_LOG}" 2>&1
        ufw default allow outgoing >> "${WAF_DEPLOY_LOG}" 2>&1
        for port in 22 80 443 8080; do
            ufw allow "${port}/tcp" >> "${WAF_DEPLOY_LOG}" 2>&1
        done
        ufw --force enable >> "${WAF_DEPLOY_LOG}" 2>&1
        say_ok "UFW: 22/SSH  80/HTTP  443/HTTPS  8080/Console"
    else
        say_warn "ufw not found — skipping firewall"
    fi

    end_phase
}

# ==============================================================
# Health checks
# ==============================================================
run_health_checks() {
    sleep 3
    printf "\n  ${_D}%s${_0}\n\n" "$(printf '─%.0s' {1..58})"
    say_run "Running health checks"

    curl -fsS http://localhost:3001/api/health 2>/dev/null | grep -q "success" \
        && say_ok  "Backend  — http://localhost:3001/api/health" \
        || say_warn "Backend health check did not pass yet"

    curl -fsS http://localhost:8080 2>/dev/null | grep -qi "doctype" \
        && say_ok  "Console  — http://localhost:8080" \
        || say_warn "Console health check did not pass — check: systemctl status nginx"
}

# ==============================================================
# Save credentials
# ==============================================================
save_credentials() {
    local cred_file="/root/.waf-credentials"
    cat > "${cred_file}" << CREDEOF
# Bach Dang WAF — Deployment credentials
# Written: $(date)
# KEEP THIS FILE SECURE

Management Console (LAN)    : http://${WAF_LAN_IP}:8080
Management Console (Public) : http://${WAF_PUBLIC_IP}:8080
API Backend                 : http://${WAF_LAN_IP}:3001

Default login
  Username : admin
  Password : admin123
  (Change immediately after first login)

Database
  Container : ${WAF_DB_CONTAINER}
  Name      : ${WAF_DB_NAME}
  User      : ${WAF_DB_USER}
  Password  : ${WAF_DB_PASS}
  Port      : ${WAF_DB_PORT}

Secrets
  JWT access  : ${WAF_JWT_ACCESS}
  JWT refresh : ${WAF_JWT_REFRESH}
  Session     : ${WAF_SESSION_KEY}

Deploy log  : ${WAF_DEPLOY_LOG}
CREDEOF
    chmod 600 "${cred_file}"
    say_ok "Credentials saved to ${cred_file}"
}

# ==============================================================
# Summary
# ==============================================================
print_summary() {
    local ts; ts=$(date '+%Y-%m-%d %H:%M:%S')
    printf "\n  ${_D}%s${_0}\n" "$(printf '─%.0s' {1..58})"
    printf "\n  ${_B}${_G}  Bootstrap complete — ${ts}${_0}\n\n"
    printf "  ${_D}Access${_0}\n"
    printf "    Console (LAN)    http://${WAF_LAN_IP}:8080\n"
    [[ "${WAF_LAN_IP}" != "${WAF_PUBLIC_IP}" ]] && \
        printf "    Console (WAN)    http://${WAF_PUBLIC_IP}:8080\n"
    printf "\n  ${_D}Default credentials${_0}\n"
    printf "    Username: admin     Password: admin123\n"
    printf "    Change immediately after first login.\n"
    printf "\n  ${_D}Service management${_0}\n"
    printf "    systemctl {status|restart|stop} bach-dang-waf-backend\n"
    printf "    systemctl {status|restart|stop} nginx\n"
    printf "    docker {start|stop|logs} ${WAF_DB_CONTAINER}\n"
    printf "\n  ${_D}Log files${_0}\n"
    printf "    Bootstrap : ${WAF_DEPLOY_LOG}\n"
    printf "    API       : /var/log/bach-dang-waf-backend.log\n"
    printf "\n  ${_D}%s${_0}\n\n" "$(printf '─%.0s' {1..58})"
}

# ==============================================================
# Main
# ==============================================================
main() {
    require_root

    # Move log to /var/log now that we're root
    WAF_DEPLOY_LOG="/var/log/bach-dang-waf-bootstrap.log"
    [[ -f /tmp/waf-bootstrap.log ]] && {
        cat /tmp/waf-bootstrap.log >> "${WAF_DEPLOY_LOG}" 2>/dev/null || true
        rm -f /tmp/waf-bootstrap.log
    }
    mkdir -p "$(dirname "${WAF_DEPLOY_LOG}")"

    resolve_dirs

    # Generate secrets
    WAF_DB_CONTAINER="waf-database"
    WAF_DB_NAME="bach_dang_waf_db"
    WAF_DB_USER="bach_dang_waf_user"
    WAF_DB_PASS="$(gen_secret 32)"
    WAF_DB_PORT=5432
    WAF_JWT_ACCESS="$(gen_secret 64)"
    WAF_JWT_REFRESH="$(gen_secret 64)"
    WAF_SESSION_KEY="$(gen_secret 64)"

    # Resolve IPs
    WAF_PUBLIC_IP="$(curl -fsS --max-time 5 ifconfig.me \
                 || curl -fsS --max-time 5 icanhazip.com \
                 || curl -fsS --max-time 5 ipinfo.io/ip \
                 || echo "")"
    WAF_LAN_IP="$(ip route get 1.1.1.1 2>/dev/null \
                  | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1 \
                  || hostname -I 2>/dev/null | awk '{print $1}' \
                  || echo "localhost")"
    [[ -z "${WAF_PUBLIC_IP}" ]] && WAF_PUBLIC_IP="${WAF_LAN_IP}"

    print_banner

    say_note "Started          : $(date '+%Y-%m-%d %H:%M:%S')"
    say_note "Install root     : ${WAF_ROOT}"
    say_note "LAN IP           : ${WAF_LAN_IP}"
    [[ "${WAF_LAN_IP}" != "${WAF_PUBLIC_IP}" ]] && \
        say_note "Public IP        : ${WAF_PUBLIC_IP}"
    say_note "Log              : ${WAF_DEPLOY_LOG}"
    printf "\n  ${_D}%s${_0}\n" "$(printf '─%.0s' {1..58})"

    phase_prerequisites
    phase_database
    phase_engine
    phase_api
    phase_web
    phase_nginx_config
    phase_services
    phase_start
    run_health_checks
    save_credentials
    print_summary
}

main "$@"
