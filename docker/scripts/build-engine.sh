#!/bin/bash
# ============================================================
#  Bach Dang WAF — Docker Image Builder
#  Compiles Nginx + ModSecurity inside the Docker build
#  context. Designed to run without systemd.
#
#  Nginx    : 1.24.0 (LTS)
#  ModSec   : 3.0.12
#  Base     : ubuntu:22.04 / debian:bookworm
# ============================================================

set -euo pipefail

# --------------------------------------------------
# Versions
# --------------------------------------------------
NGINX_VER="1.24.0"
MODSEC_VER="3.0.12"
MODSEC_CONNECTOR_VER="1.0.3"

# --------------------------------------------------
# Paths
# --------------------------------------------------
BUILD_DIR="/usr/local/src/waf"
WAF_RULES_DIR="/etc/nginx/waf"
NGINX_BASE="/etc/nginx"
MOD_DIR="/usr/lib/nginx/modules"
WEB_DIR="/var/www/html"

BUILD_LOG="/var/log/waf-build.log"
PHASE_TRACK="/var/run/waf-build.state"

# --------------------------------------------------
# Colours (used only when stdout is a tty)
# --------------------------------------------------
if [[ -t 1 ]]; then
    OK='\033[0;32m'; FAIL='\033[0;31m'; HINT='\033[0;36m'; RST='\033[0m'
else
    OK=''; FAIL=''; HINT=''; RST=''
fi

# --------------------------------------------------
# Output helpers
# --------------------------------------------------
stamp() { date '+%H:%M:%S'; }

out()  { printf "[%s] %s\n"        "$(stamp)" "$*" | tee -a "${BUILD_LOG}"; }
ok()   { printf "[%s] ${OK}OK${RST}  %s\n"    "$(stamp)" "$*" | tee -a "${BUILD_LOG}"; }
err()  { printf "[%s] ${FAIL}ERR${RST} %s\n"  "$(stamp)" "$*" | tee -a "${BUILD_LOG}"; }
hint() { printf "[%s] ${HINT}--${RST}  %s\n"  "$(stamp)" "$*" | tee -a "${BUILD_LOG}"; }

abort() {
    err "$*"
    track "aborted" "failed" "$*"
    exit 1
}

track() {
    # track phase  state  detail
    printf 'phase=%s state=%s detail=%q ts=%s\n' \
        "$1" "$2" "$3" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        > "${PHASE_TRACK}"
}

# ==================================================
# STAGE 0 — Sanity check
# ==================================================
[[ "${EUID}" -eq 0 ]] || abort "Run as root."

mkdir -p "$(dirname "${BUILD_LOG}")"
out "=== Bach Dang WAF Docker build — Nginx ${NGINX_VER} + ModSec ${MODSEC_VER} ==="

# ==================================================
# STAGE 1 — Build toolchain
# ==================================================
out "[1/8] Installing build toolchain..."
track "toolchain" "running" "apt-get"

apt-get update -qq >> "${BUILD_LOG}" 2>&1 || abort "apt-get update failed"

DEBIAN_FRONTEND=noninteractive \
apt-get install -y --no-install-recommends \
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
    git wget ca-certificates \
    >> "${BUILD_LOG}" 2>&1 || abort "Failed installing toolchain packages"

ok "[1/8] Toolchain ready"
track "toolchain" "done" "packages installed"

# ==================================================
# STAGE 2 — Clone ModSecurity
# ==================================================
out "[2/8] Cloning ModSecurity v${MODSEC_VER}..."
track "clone_modsec" "running" "git"

mkdir -p "${BUILD_DIR}" && cd "${BUILD_DIR}"

if [[ ! -d "ModSecurity" ]]; then
    git clone --depth 1 \
        -b "v${MODSEC_VER}" --single-branch \
        https://github.com/owasp-modsecurity/ModSecurity \
        >> "${BUILD_LOG}" 2>&1 || abort "ModSecurity clone failed"
else
    hint "[2/8] ModSecurity already cloned — reusing"
fi

ok "[2/8] ModSecurity source ready"
track "clone_modsec" "done" "source present"

# ==================================================
# STAGE 3 — Build ModSecurity
# ==================================================
out "[3/8] Compiling ModSecurity (10-15 min)..."
track "build_modsec" "running" "make -j$(nproc)"

cd "${BUILD_DIR}/ModSecurity"
git submodule init   >> "${BUILD_LOG}" 2>&1
git submodule update >> "${BUILD_LOG}" 2>&1

./build.sh  >> "${BUILD_LOG}" 2>&1 || abort "./build.sh failed"
./configure >> "${BUILD_LOG}" 2>&1 || abort "./configure failed"
make -j"$(nproc)" >> "${BUILD_LOG}" 2>&1 || abort "make failed"
make install       >> "${BUILD_LOG}" 2>&1 || abort "make install failed"

ok "[3/8] ModSecurity compiled and installed"
track "build_modsec" "done" "libmodsecurity installed"

# ==================================================
# STAGE 4 — Clone nginx connector
# ==================================================
out "[4/8] Cloning ModSecurity-nginx connector..."
track "clone_connector" "running" "git"

cd "${BUILD_DIR}"

if [[ ! -d "ModSecurity-nginx" ]]; then
    git clone --depth 1 \
        https://github.com/owasp-modsecurity/ModSecurity-nginx.git \
        >> "${BUILD_LOG}" 2>&1 || abort "ModSecurity-nginx clone failed"
else
    hint "[4/8] Connector already cloned — reusing"
fi

ok "[4/8] Connector source ready"
track "clone_connector" "done" "source present"

# ==================================================
# STAGE 5 — Download Nginx
# ==================================================
out "[5/8] Downloading Nginx ${NGINX_VER}..."
track "download_nginx" "running" "wget"

cd "${BUILD_DIR}"

local_tar="nginx-${NGINX_VER}.tar.gz"

if [[ ! -f "${local_tar}" ]]; then
    wget -q "http://nginx.org/download/${local_tar}" \
        >> "${BUILD_LOG}" 2>&1 || abort "wget nginx tarball failed"
fi

[[ -d "nginx-${NGINX_VER}" ]] || \
    tar -xzf "${local_tar}" >> "${BUILD_LOG}" 2>&1 \
    || abort "tar extract failed"

ok "[5/8] Nginx source extracted"
track "download_nginx" "done" "nginx-${NGINX_VER} ready"

# ==================================================
# STAGE 6 — Compile Nginx + ModSecurity module
# ==================================================
out "[6/8] Compiling Nginx (5-10 min)..."
track "build_nginx" "running" "make -j$(nproc)"

cd "${BUILD_DIR}/nginx-${NGINX_VER}"

./configure \
    --prefix="${NGINX_BASE}" \
    --sbin-path=/usr/sbin/nginx \
    --modules-path="${MOD_DIR}" \
    --conf-path="${NGINX_BASE}/nginx.conf" \
    --error-log-path=/var/log/nginx/error.log \
    --http-log-path=/var/log/nginx/access.log \
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
    --add-dynamic-module="${BUILD_DIR}/ModSecurity-nginx" \
    >> "${BUILD_LOG}" 2>&1 || abort "nginx configure failed"

make -j"$(nproc)" >> "${BUILD_LOG}" 2>&1 || abort "nginx make failed"
make install       >> "${BUILD_LOG}" 2>&1 || abort "nginx make install failed"

mkdir -p "${MOD_DIR}"
cp objs/ngx_http_modsecurity_module.so "${MOD_DIR}/" \
    || abort "Failed to copy modsecurity module .so"

ok "[6/8] Nginx compiled — module at ${MOD_DIR}/ngx_http_modsecurity_module.so"
track "build_nginx" "done" "nginx ${NGINX_VER} installed"

# ==================================================
# STAGE 7 — ModSecurity rules + OWASP CRS
# ==================================================
out "[7/8] Deploying ModSecurity config and OWASP CRS..."
track "configure_waf" "running" "setup"

mkdir -p "${WAF_RULES_DIR}" /var/log/waf

cp "${BUILD_DIR}/ModSecurity/modsecurity.conf-recommended" \
    "${WAF_RULES_DIR}/modsecurity.conf"
cp "${BUILD_DIR}/ModSecurity/unicode.mapping" \
    "${WAF_RULES_DIR}/"

# Switch from detection-only to enforcement
sed -i 's/SecRuleEngine DetectionOnly/SecRuleEngine On/' \
    "${WAF_RULES_DIR}/modsecurity.conf"

if [[ ! -d "${WAF_RULES_DIR}/crs" ]]; then
    git clone --depth 1 \
        https://github.com/coreruleset/coreruleset.git \
        "${WAF_RULES_DIR}/crs" \
        >> "${BUILD_LOG}" 2>&1 || abort "CRS clone failed"
    mv "${WAF_RULES_DIR}/crs/crs-setup.conf.example" \
       "${WAF_RULES_DIR}/crs/crs-setup.conf"
else
    hint "[7/8] CRS already present — skipping"
fi

# Ruleset loader
cat > "${WAF_RULES_DIR}/active.conf" << 'RULEEOF'
# Bach Dang WAF — active ModSecurity ruleset (Docker build)
Include /etc/nginx/waf/modsecurity.conf
Include /etc/nginx/waf/crs/crs-setup.conf
Include /etc/nginx/waf/crs/rules/*.conf
RULEEOF

ok "[7/8] ModSecurity + CRS configured"
track "configure_waf" "done" "enforcement on"

# ==================================================
# STAGE 8 — Nginx base config + start
# ==================================================
out "[8/8] Writing nginx.conf and starting nginx..."
track "configure_nginx" "running" "write + start"

mkdir -p \
    "${NGINX_BASE}/sites-available" \
    "${NGINX_BASE}/sites-enabled" \
    "${NGINX_BASE}/snippets" \
    "${NGINX_BASE}/conf.d" \
    "${NGINX_BASE}/ssl" \
    /var/log/nginx \
    "${WEB_DIR}/.well-known/acme-challenge"

chmod -R 755 "${WEB_DIR}/.well-known"
touch "${NGINX_BASE}/conf.d/acl-rules.conf"

cat > "${NGINX_BASE}/nginx.conf" << 'NGEOF'
# Bach Dang WAF — Docker image nginx config
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
    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout 65;
    server_tokens   off;
    client_max_body_size 100M;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

    log_format waf_combined
        '$remote_addr - $remote_user [$time_local] "$request" '
        '$status $body_bytes_sent "$http_referer" '
        '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log waf_combined;
    error_log  /var/log/nginx/error.log warn;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss;

    modsecurity on;
    modsecurity_rules_file /etc/nginx/waf/active.conf;

    include /etc/nginx/sites-enabled/*;
}
NGEOF

cat > "${NGINX_BASE}/sites-available/default" << 'VHEOF'
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
VHEOF

# Disable IPv6 listener — may not be available in all Docker networks
sed -i 's/^\s*listen \[::\]:80 default_server;/# &/' \
    "${NGINX_BASE}/sites-available/default" 2>/dev/null || true

ln -sf "${NGINX_BASE}/sites-available/default" \
       "${NGINX_BASE}/sites-enabled/default"

chown -R www-data:www-data "${WEB_DIR}"
chmod -R 755 "${WEB_DIR}"

# Start nginx — detect environment
if [[ "$(ps -p 1 -o comm= 2>/dev/null)" == "systemd" ]]; then
    out "  systemd detected — enabling service"
    systemctl daemon-reload
    systemctl enable nginx >> "${BUILD_LOG}" 2>&1
    systemctl start  nginx >> "${BUILD_LOG}" 2>&1
else
    out "  No systemd (Docker build) — starting nginx directly"
    nginx -t >> "${BUILD_LOG}" 2>&1 || abort "nginx config test failed"
    nginx    >> "${BUILD_LOG}" 2>&1 || abort "nginx start failed"
fi

nginx -t >> "${BUILD_LOG}" 2>&1 || abort "Post-start nginx config test failed"

ok "[8/8] Nginx running"
track "configure_nginx" "done" "serving"

# ==================================================
# Summary
# ==================================================
track "complete" "success" "nginx+modsecurity docker build done"

out ""
out "==================================================================="
out "  Bach Dang WAF — Docker build complete"
out "  Nginx     : $(nginx -v 2>&1)"
out "  ModSec    : active (${WAF_RULES_DIR}/active.conf)"
out "  Modules   : ${MOD_DIR}"
out "  Config    : ${NGINX_BASE}"
out "  Logs      : /var/log/nginx, /var/log/waf"
out "  Health    : GET /healthz"
out "==================================================================="
