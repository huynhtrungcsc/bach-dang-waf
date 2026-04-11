#!/bin/bash
# ============================================================
#  Bach Dang WAF — Docker + Compose Installer
#  Installs Docker CE and Docker Compose v2 on Ubuntu/Debian.
#
#  Usage: sudo bash docker/scripts/setup-docker.sh
# ============================================================

set -euo pipefail

INSTALL_LOG="/var/log/waf-docker-setup.log"

# ----------------------------------------------------------
# Helpers
# ----------------------------------------------------------
ts()  { date '+%H:%M:%S'; }
out() { printf '[%s] %s\n'    "$(ts)" "$*" | tee -a "${INSTALL_LOG}"; }
ok()  { printf '[%s] ok  %s\n' "$(ts)" "$*" | tee -a "${INSTALL_LOG}"; }
err() { printf '[%s] ERR %s\n' "$(ts)" "$*" | tee -a "${INSTALL_LOG}"; exit 1; }

[[ "${EUID}" -eq 0 ]] || err "Run as root."
mkdir -p "$(dirname "${INSTALL_LOG}")"

out "=== Bach Dang WAF — Docker setup ==="

# ==============================================================
# 1. Docker CE
# ==============================================================
out "[1/3] Installing Docker CE via official install script..."

if command -v docker &>/dev/null; then
    ok "[1/3] Docker already present: $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo 'ok')"
else
    curl -fsSL https://get.docker.com | sh >> "${INSTALL_LOG}" 2>&1 \
        || err "Docker install script failed"
    systemctl enable docker >> "${INSTALL_LOG}" 2>&1
    systemctl start  docker >> "${INSTALL_LOG}" 2>&1
    ok "[1/3] Docker installed: $(docker version --format '{{.Server.Version}}' 2>/dev/null)"
fi

# ==============================================================
# 2. Docker Compose v2 (standalone binary)
# ==============================================================
out "[2/3] Installing Docker Compose v2..."

if docker compose version &>/dev/null 2>&1; then
    ok "[2/3] Docker Compose already present: $(docker compose version --short 2>/dev/null)"
elif command -v docker-compose &>/dev/null; then
    ok "[2/3] docker-compose (v1) already present: $(docker-compose -v)"
else
    out "  Fetching latest Docker Compose release tag..."
    COMPOSE_VER="$(curl -fsS \
        https://api.github.com/repos/docker/compose/releases/latest \
        | grep '"tag_name"' | cut -d'"' -f4 || echo "")"

    [[ -z "${COMPOSE_VER}" ]] && {
        COMPOSE_VER="v2.24.0"
        out "  Could not fetch latest — defaulting to ${COMPOSE_VER}"
    }

    ARCH="$(uname -m)"
    OS="$(uname -s)"
    COMPOSE_BIN="/usr/local/lib/docker/cli-plugins/docker-compose"
    mkdir -p "$(dirname "${COMPOSE_BIN}")"

    out "  Downloading ${OS}-${ARCH} ${COMPOSE_VER}..."
    curl -fsSL \
        "https://github.com/docker/compose/releases/download/${COMPOSE_VER}/docker-compose-${OS}-${ARCH}" \
        -o "${COMPOSE_BIN}" >> "${INSTALL_LOG}" 2>&1 \
        || err "Docker Compose download failed"

    chmod +x "${COMPOSE_BIN}"

    # Symlink for backward-compat
    ln -sf "${COMPOSE_BIN}" /usr/local/bin/docker-compose 2>/dev/null || true

    ok "[2/3] Docker Compose installed: $(docker compose version --short 2>/dev/null)"
fi

# ==============================================================
# 3. Shell completion (non-fatal)
# ==============================================================
out "[3/3] Installing shell completion (best-effort)..."

COMP_DIR="/etc/bash_completion.d"
if [[ -d "${COMP_DIR}" ]]; then
    COMPOSE_VER="${COMPOSE_VER:-$(docker compose version --short 2>/dev/null | tr -d ' ')}"
    curl -fsSL \
        "https://raw.githubusercontent.com/docker/compose/${COMPOSE_VER}/contrib/completion/bash/docker-compose" \
        -o "${COMP_DIR}/docker-compose" >> "${INSTALL_LOG}" 2>&1 \
        && ok "[3/3] Bash completion installed" \
        || out "[3/3] Completion download skipped (non-fatal)"
else
    out "[3/3] ${COMP_DIR} not found — skipping completion"
fi

# ==============================================================
# Summary
# ==============================================================
out ""
out "==================================================================="
out "  Bach Dang WAF — Docker setup complete"
out "  Docker         : $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo 'ok')"
out "  Docker Compose : $(docker compose version --short 2>/dev/null || docker-compose -v 2>/dev/null | head -1)"
out "  Log            : ${INSTALL_LOG}"
out "==================================================================="
