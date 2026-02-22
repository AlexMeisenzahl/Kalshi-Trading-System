#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Kalshi-Claw  |  macOS Installer
#  Installs: Xcode CLT, Homebrew, Rust, Node.js 20+, napi-rs, builds
#  the Rust native addon, installs npm deps, and sets up .env.
#
#  Run with: bash install.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}▶  $*${RESET}"; }
success() { echo -e "${GREEN}✓  $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠  $*${RESET}"; }
error()   { echo -e "${RED}✗  $*${RESET}"; exit 1; }
ruler()   { echo -e "${BOLD}────────────────────────────────────────${RESET}"; }

clear
echo ""
echo -e "${CYAN}${BOLD}"
echo " ██╗  ██╗ █████╗ ██╗     ███████╗██╗  ██╗██╗      ██████╗██╗      █████╗ ██╗    ██╗"
echo " ██║ ██╔╝██╔══██╗██║     ██╔════╝██║  ██║██║     ██╔════╝██║     ██╔══██╗██║    ██║"
echo " █████╔╝ ███████║██║     ███████╗███████║██║     ██║     ██║     ███████║██║ █╗ ██║"
echo " ██╔═██╗ ██╔══██║██║     ╚════██║██╔══██║██║     ██║     ██║     ██╔══██║██║███╗██║"
echo " ██║  ██╗██║  ██║███████╗███████║██║  ██║██║     ╚██████╗███████╗██║  ██║╚███╔███╔╝"
echo " ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝      ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝"
echo -e "${RESET}"
echo -e "  ${BOLD}Kalshi skill for OpenClaw  |  Rust + TypeScript  |  macOS installer${RESET}"
echo ""
ruler

# ── macOS guard ──────────────────────────────────────────────────────────────
if [[ "$(uname)" != "Darwin" ]]; then
    error "This installer supports macOS only. Detected: $(uname)"
fi
success "macOS $(sw_vers -productVersion)"

# ── Xcode CLT ────────────────────────────────────────────────────────────────
ruler; info "Checking Xcode Command Line Tools…"
if ! xcode-select -p &>/dev/null; then
    warn "Xcode CLT not found — installing (follow the dialog)…"
    xcode-select --install
    echo "  Restart this script after the installation completes."
    exit 0
fi
success "Xcode CLT: $(xcode-select -p)"

# ── Homebrew ─────────────────────────────────────────────────────────────────
ruler; info "Checking Homebrew…"
if ! command -v brew &>/dev/null; then
    warn "Installing Homebrew…"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
fi
success "Homebrew $(brew --version | head -1)"

# ── Rust ─────────────────────────────────────────────────────────────────────
ruler; info "Checking Rust toolchain…"
if ! command -v rustc &>/dev/null; then
    warn "Installing Rust via rustup…"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --quiet
fi
# shellcheck disable=SC1090
source "$HOME/.cargo/env" 2>/dev/null || true
export PATH="$HOME/.cargo/bin:$PATH"
success "Rust $(rustc --version)"

# ── Node.js ≥ 20 ─────────────────────────────────────────────────────────────
ruler; info "Checking Node.js…"
if ! command -v node &>/dev/null || [[ "$(node -e 'process.exit(+process.version.slice(1)<20)')" ]]; then
    warn "Node.js 20+ not found — installing via Homebrew…"
    brew install node@20
    brew link --force --overwrite node@20
    export PATH="$(brew --prefix node@20)/bin:$PATH"
fi
success "Node $(node --version)  |  npm $(npm --version)"

# ── napi-rs CLI ──────────────────────────────────────────────────────────────
ruler; info "Checking napi-rs CLI…"
if ! command -v napi &>/dev/null; then
    warn "Installing @napi-rs/cli globally…"
    npm install -g @napi-rs/cli
fi
success "napi $(napi --version)"

# ── npm dependencies ─────────────────────────────────────────────────────────
ruler; info "Installing npm dependencies…"
npm install --silent
success "npm dependencies installed"

# ── Build Rust native addon ───────────────────────────────────────────────────
ruler; info "Building Rust native addon (kalshi_claw_core.node)…"
napi build --platform --release
success "Rust addon built: $(ls kalshi_claw_core.*.node 2>/dev/null | head -1)"

# ── .env setup ───────────────────────────────────────────────────────────────
ruler
if [[ ! -f ".env" ]]; then
    info "Creating .env from template…"
    cp env_template.txt .env
    warn ".env created — add your API keys before running!"
else
    warn ".env already exists — not overwritten"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
ruler
echo ""
echo -e "${GREEN}${BOLD}  ✓  Kalshi-Claw installed successfully!${RESET}"
echo ""
echo -e "  ${BOLD}Next steps:${RESET}"
echo ""
echo -e "  1. Add your API keys:      ${CYAN}open -e .env${RESET}"
echo ""
echo -e "  2. Browse trending markets:"
echo -e "     ${CYAN}npx tsx scripts/kalshi-claw.ts markets trending${RESET}"
echo ""
echo -e "  3. Scan for hedge opportunities:"
echo -e "     ${CYAN}npx tsx scripts/kalshi-claw.ts hedge scan${RESET}"
echo ""
echo -e "  4. Buy a position (dry-run safe):"
echo -e "     ${CYAN}npx tsx scripts/kalshi-claw.ts buy <TICKER> YES 25${RESET}"
echo ""
echo -e "  See README.md for full documentation."
echo ""
