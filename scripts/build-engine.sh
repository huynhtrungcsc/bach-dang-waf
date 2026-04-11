#!/bin/bash
# ============================================================
#  Bach Dang WAF — Nginx + ModSecurity Builder
#  Builds Nginx from source with ModSecurity dynamic module
#  and OWASP CRS, tailored for WAF proxy deployments.
#
#  Target: Ubuntu 22.04 / Debian 12
#  Run as: root
# ============================================================

set -euo pipefail

# --------------------------------------------------
# Build targets
# --------------------------------------------------
NGINX_VER="1.28.0"
MODSEC_VER="3.0.14"
MODSEC_NGINX_CONNECTOR_VER="1.0.4"

# --------------------------------------------------
# Paths
# --------------------------------------------------
BUILD_ROOT="/usr/local/src/bach-dang-waf-build"
WAF_CONF_DIR="/etc/nginx/waf"
NGINX_CONF_DIR="/etc/nginx"
NGINX_LOG_DIR="/var/log/nginx"
WAF_LOG_DIR="/var/log/waf"
MODULE_DIR="/usr/lib/nginx/modules"
WEBROOT="/var/www/html"

BUILD_LOG="/var/log/waf-nginx-build.log"
PHASE_FILE="/var/run/waf-nginx-build.phase"

# --------------------------------------------------
# Terminal colours
# --------------------------------------------------
C_OK='\033[0;32m'
C_ERR='\033[0;31m'
C_WARN='\033[1;33m'
C_INFO='\033[0;36m'
C_RESET='\033[0m'

# --------------------------------------------------
# Helpers
# --------------------------------------------------
ts() { date '+%Y-%m-%d %H:%M:%S'; }

waf_log() {
    local level="$1"; shift
    printf "[%s] [%-5s] %s\n" "$(ts)" "$level" "$*" | tee -a "${BUILD_LOG}"
}

waf_phase() {
    # phase_key  phase_label  state  detail
    local key="$1" label="$2" state="$3" detail="$4"
    printf '{"phase":"%s","label":"%s","state":"%s","detail":"%s","at":"%s"}\n' \
        "$key" "$label" "$state" "$detail" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        > "${PHASE_FILE}"
    waf_log INFO "$label — $state"
}

die() {
    waf_log ERROR "$*"
    waf_phase "aborted" "Build aborted" "failed" "$*"
    exit 1
}

require_root() {
    [[ "${EUID}" -eq 0 ]] || die "Must be run as root."
}

# --------------------------------------------------
# Banner
# --------------------------------------------------
print_banner() {
    echo ""
    echo "  ╔══════════════════════════════════════════════════╗"
    echo "  ║         B A C H  D A N G  W A F                 ║"
    echo "  ║     Nginx ${NGINX_VER} + ModSecurity ${MODSEC_VER}           ║"
    echo "  ║     OWASP Core Rule Set  —  Source Build         ║"
    echo "  ╚══════════════════════════════════════════════════╝"
    echo ""
}

# ==================================================
# PHASE 0 — Prerequisites
# ==================================================
phase_deps() {
    waf_phase "deps" "Installing build dependencies" "running" "apt-get"

    apt-get update >> "${BUILD_LOG}" 2>&1 \
        || die "apt-get update failed"

    apt-get install -y \
        build-essential \
        libpcre3 libpcre3-dev \
        zlib1g zlib1g-dev \
        libssl-dev \
        libgd-dev \
        libgeoip-dev \
        libxml2 libxml2-dev \
        libyajl-dev \
        liblmdb-dev \
        libcurl4-openssl-dev \
        libtool automake autoconf \
        git wget \
        >> "${BUILD_LOG}" 2>&1 \
        || die "Failed to install build dependencies"

    waf_phase "deps" "Build dependencies" "done" "all packages installed"
}

# ==================================================
# PHASE 1 — Fetch ModSecurity
# ==================================================
phase_fetch_modsec() {
    waf_phase "fetch_modsec" "Fetch ModSecurity ${MODSEC_VER}" "running" "git clone"

    mkdir -p "${BUILD_ROOT}" && cd "${BUILD_ROOT}"

    if [[ ! -d "ModSecurity" ]]; then
        git clone --depth 1 \
            -b "v${MODSEC_VER}" --single-branch \
            https://github.com/owasp-modsecurity/ModSecurity \
            >> "${BUILD_LOG}" 2>&1 \
            || die "git clone ModSecurity failed"
    else
        waf_log INFO "ModSecurity source already present — skipping clone"
    fi

    waf_phase "fetch_modsec" "Fetch ModSecurity ${MODSEC_VER}" "done" "source ready"
}

# ==================================================
# PHASE 2 — Compile ModSecurity
# ==================================================
phase_build_modsec() {
    waf_phase "build_modsec" "Compile ModSecurity ${MODSEC_VER}" "running" "make -j$(nproc)"

    cd "${BUILD_ROOT}/ModSecurity"
    git submodule init  >> "${BUILD_LOG}" 2>&1
    git submodule update >> "${BUILD_LOG}" 2>&1

    ./build.sh   >> "${BUILD_LOG}" 2>&1 || die "ModSecurity build.sh failed"
    ./configure  >> "${BUILD_LOG}" 2>&1 || die "ModSecurity configure failed"
    make -j"$(nproc)" >> "${BUILD_LOG}" 2>&1 || die "ModSecurity make failed"
    make install  >> "${BUILD_LOG}" 2>&1 || die "ModSecurity make install failed"

    waf_phase "build_modsec" "Compile ModSecurity ${MODSEC_VER}" "done" "library installed"
}

# ==================================================
# PHASE 3 — Fetch nginx connector
# ==================================================
phase_fetch_connector() {
    waf_phase "fetch_connector" "Fetch ModSecurity-nginx connector" "running" "git clone"

    cd "${BUILD_ROOT}"

    if [[ ! -d "ModSecurity-nginx" ]]; then
        git clone --depth 1 \
            https://github.com/owasp-modsecurity/ModSecurity-nginx.git \
            >> "${BUILD_LOG}" 2>&1 \
            || die "git clone ModSecurity-nginx failed"
    else
        waf_log INFO "Connector source already present — skipping clone"
    fi

    waf_phase "fetch_connector" "Fetch ModSecurity-nginx connector" "done" "source ready"
}

# ==================================================
# PHASE 4 — Fetch Nginx
# ==================================================
phase_fetch_nginx() {
    waf_phase "fetch_nginx" "Fetch Nginx ${NGINX_VER}" "running" "wget"

    cd "${BUILD_ROOT}"

    local tarball="nginx-${NGINX_VER}.tar.gz"

    if [[ ! -f "${tarball}" ]]; then
        wget -q "http://nginx.org/download/${tarball}" \
            >> "${BUILD_LOG}" 2>&1 \
            || die "wget nginx tarball failed"
    fi

    [[ -d "nginx-${NGINX_VER}" ]] || \
        tar -xzf "${tarball}" >> "${BUILD_LOG}" 2>&1 \
        || die "tar extract nginx failed"

    waf_phase "fetch_nginx" "Fetch Nginx ${NGINX_VER}" "done" "source extracted"
}

# ==================================================
# PHASE 5 — Compile Nginx with ModSecurity
# ==================================================
phase_build_nginx() {
    waf_phase "build_nginx" "Compile Nginx ${NGINX_VER}" "running" "make -j$(nproc)"

    cd "${BUILD_ROOT}/nginx-${NGINX_VER}"

    ./configure \
        --prefix="${NGINX_CONF_DIR}" \
        --sbin-path=/usr/sbin/nginx \
        --modules-path="${MODULE_DIR}" \
        --conf-path="${NGINX_CONF_DIR}/nginx.conf" \
        --error-log-path="${NGINX_LOG_DIR}/error.log" \
        --http-log-path="${NGINX_LOG_DIR}/access.log" \
        --pid-path=/var/run/nginx.pid \
        --lock-path=/var/run/nginx.lock \
        --user=www-data \
        --group=www-data \
        --with-http_ssl_module \
        --with-http_v2_module \
        --with-http_realip_module \
        --with-http_addition_module \
        --with-http_sub_module \
        --with-http_dav_module \
        --with-http_flv_module \
        --with-http_mp4_module \
        --with-http_gunzip_module \
        --with-http_gzip_static_module \
        --with-http_random_index_module \
        --with-http_secure_link_module \
        --with-http_stub_status_module \
        --with-http_auth_request_module \
        --with-http_geoip_module \
        --with-threads \
        --with-stream \
        --with-stream_ssl_module \
        --with-stream_realip_module \
        --with-stream_geoip_module \
        --with-http_slice_module \
        --with-file-aio \
        --add-dynamic-module="${BUILD_ROOT}/ModSecurity-nginx" \
        >> "${BUILD_LOG}" 2>&1 || die "nginx configure failed"

    make -j"$(nproc)" >> "${BUILD_LOG}" 2>&1 || die "nginx make failed"
    make install      >> "${BUILD_LOG}" 2>&1 || die "nginx make install failed"

    mkdir -p "${MODULE_DIR}"
    cp objs/ngx_http_modsecurity_module.so "${MODULE_DIR}/" \
        || die "Failed to copy ModSecurity .so module"

    waf_phase "build_nginx" "Compile Nginx ${NGINX_VER}" "done" "binary at /usr/sbin/nginx"
}

# ==================================================
# PHASE 6 — Deploy ModSecurity config & CRS
# ==================================================
phase_configure_waf() {
    waf_phase "configure_waf" "Configure ModSecurity + OWASP CRS" "running" "setup"

    mkdir -p "${WAF_CONF_DIR}" "${WAF_LOG_DIR}"

    cp "${BUILD_ROOT}/ModSecurity/modsecurity.conf-recommended" \
        "${WAF_CONF_DIR}/modsecurity.conf"
    cp "${BUILD_ROOT}/ModSecurity/unicode.mapping" \
        "${WAF_CONF_DIR}/"

    # Activate enforcement mode
    sed -i 's/SecRuleEngine DetectionOnly/SecRuleEngine On/' \
        "${WAF_CONF_DIR}/modsecurity.conf"

    # OWASP CRS
    if [[ ! -d "${WAF_CONF_DIR}/crs" ]]; then
        git clone --depth 1 \
            https://github.com/coreruleset/coreruleset.git \
            "${WAF_CONF_DIR}/crs" \
            >> "${BUILD_LOG}" 2>&1 \
            || die "git clone CRS failed"
        mv "${WAF_CONF_DIR}/crs/crs-setup.conf.example" \
           "${WAF_CONF_DIR}/crs/crs-setup.conf"
    else
        waf_log INFO "CRS already present — skipping clone"
    fi

    # WAF master include
    cat > "${WAF_CONF_DIR}/active.conf" << 'WAFEOF'
# Bach Dang WAF — ModSecurity active ruleset
Include /etc/nginx/waf/modsecurity.conf
Include /etc/nginx/waf/crs/crs-setup.conf
Include /etc/nginx/waf/crs/rules/*.conf
WAFEOF

    waf_phase "configure_waf" "Configure ModSecurity + OWASP CRS" "done" "rules active"
}

# ==================================================
# PHASE 7 — Deploy Nginx base configuration
# ==================================================
phase_configure_nginx() {
    waf_phase "configure_nginx" "Deploy Nginx base configuration" "running" "write configs"

    # Directory layout
    mkdir -p \
        "${NGINX_CONF_DIR}/sites-available" \
        "${NGINX_CONF_DIR}/sites-enabled" \
        "${NGINX_CONF_DIR}/snippets" \
        "${NGINX_CONF_DIR}/conf.d" \
        "${NGINX_CONF_DIR}/ssl" \
        "${NGINX_LOG_DIR}" \
        "${WEBROOT}/.well-known/acme-challenge"

    chmod -R 755 "${WEBROOT}/.well-known"
    touch "${NGINX_CONF_DIR}/conf.d/acl-rules.conf"

    # nginx.conf
    cat > "${NGINX_CONF_DIR}/nginx.conf" << 'NGINXEOF'
# Bach Dang WAF — Nginx base configuration
user www-data;
worker_processes auto;
pid /var/run/nginx.pid;
load_module /usr/lib/nginx/modules/ngx_http_modsecurity_module.so;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    # ---- Core ----
    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout 65;
    server_tokens   off;
    client_max_body_size 100M;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # ---- TLS defaults ----
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

    # ---- Logging ----
    log_format waf_combined
        '$remote_addr - $remote_user [$time_local] "$request" '
        '$status $body_bytes_sent "$http_referer" '
        '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log waf_combined;
    error_log  /var/log/nginx/error.log warn;

    # ---- Compression ----
    gzip            on;
    gzip_vary       on;
    gzip_proxied    any;
    gzip_comp_level 6;
    gzip_types
        text/plain text/css text/xml text/javascript
        application/json application/javascript application/xml+rss;

    # ---- ModSecurity WAF ----
    modsecurity on;
    modsecurity_rules_file /etc/nginx/waf/active.conf;

    # ---- Virtual hosts ----
    include /etc/nginx/sites-enabled/*;
}
NGINXEOF

    # Default vhost (health + stub_status only — proxy vhosts are managed by WAF)
    cat > "${NGINX_CONF_DIR}/sites-available/default" << 'VHOSTEOF'
server {
    listen 80 default_server;
    server_name _;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location = /healthz {
        access_log off;
        return 200 "ok\n";
        add_header Content-Type text/plain;
    }

    location /nginx_status {
        stub_status on;
        access_log  off;
        allow 127.0.0.1;
        deny  all;
    }
}
VHOSTEOF

    ln -sf "${NGINX_CONF_DIR}/sites-available/default" \
           "${NGINX_CONF_DIR}/sites-enabled/default"

    # Placeholder index
    cat > "${WEBROOT}/index.html" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Bach Dang WAF</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
               background: #f8fafc; color: #1e293b; display: flex;
               align-items: center; justify-content: center; min-height: 100vh; }
        .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
                padding: 40px 48px; max-width: 480px; width: 100%; }
        h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 24px; }
        .row { display: flex; justify-content: space-between;
               padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: .9rem; }
        .row:last-child { border-bottom: none; }
        .label { color: #64748b; }
        .badge { background: #dcfce7; color: #15803d;
                 padding: 2px 10px; border-radius: 12px; font-size: .8rem; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Bach Dang WAF</h1>
        <div class="row"><span class="label">Status</span><span class="badge">Running</span></div>
        <div class="row"><span class="label">ModSecurity</span><span class="badge">Active</span></div>
        <div class="row"><span class="label">OWASP CRS</span><span class="badge">Enabled</span></div>
    </div>
</body>
</html>
HTMLEOF

    chown -R www-data:www-data "${WEBROOT}"
    chmod -R 755 "${WEBROOT}"

    waf_phase "configure_nginx" "Deploy Nginx base configuration" "done" "configs written"
}

# ==================================================
# PHASE 8 — Systemd service & first start
# ==================================================
phase_service() {
    waf_phase "service" "Register and start nginx service" "running" "systemd"

    cat > /etc/systemd/system/nginx.service << 'SVCEOF'
[Unit]
Description=Nginx WAF Proxy (Bach Dang WAF)
After=network-online.target remote-fs.target
Wants=network-online.target

[Service]
Type=forking
PIDFile=/var/run/nginx.pid
ExecStartPre=/usr/sbin/nginx -t -q
ExecStart=/usr/sbin/nginx
ExecReload=/bin/kill -s HUP $MAINPID
ExecStop=/bin/kill -s QUIT $MAINPID
PrivateTmp=true
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
SVCEOF

    systemctl daemon-reload
    systemctl enable nginx >> "${BUILD_LOG}" 2>&1
    systemctl start  nginx >> "${BUILD_LOG}" 2>&1

    nginx -t >> "${BUILD_LOG}" 2>&1 || die "Nginx config test failed after start"

    waf_phase "service" "Register and start nginx service" "done" "active"
}

# ==================================================
# Entry point
# ==================================================
main() {
    require_root
    print_banner

    mkdir -p "$(dirname "${BUILD_LOG}")"
    waf_log INFO "=== Bach Dang WAF — Nginx ${NGINX_VER} + ModSecurity ${MODSEC_VER} build started ==="

    phase_deps
    phase_fetch_modsec
    phase_build_modsec
    phase_fetch_connector
    phase_fetch_nginx
    phase_build_nginx
    phase_configure_waf
    phase_configure_nginx
    phase_service

    waf_phase "done" "Build complete" "success" "nginx+modsecurity running"

    echo ""
    echo -e "${C_OK}  Build complete!${C_RESET}"
    echo -e "  Nginx $(nginx -v 2>&1 | awk '{print $3}')"
    echo -e "  ModSecurity active  : ${WAF_CONF_DIR}/active.conf"
    echo -e "  Configuration root  : ${NGINX_CONF_DIR}"
    echo -e "  Log directory       : ${NGINX_LOG_DIR}"
    echo -e "  Build log           : ${BUILD_LOG}"
    echo -e "  Health endpoint     : http://localhost/healthz"
    echo ""
}

main "$@"
