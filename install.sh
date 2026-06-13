#!/bin/bash
# Hera — AI Coding Agent Architecture Reference
# Installation script for all supported agents

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_FILE="$SCRIPT_DIR/SKILL.md"
AGENTS_FILE="$SCRIPT_DIR/AGENTS.md"
CLAUDE_FILE="$SCRIPT_DIR/CLAUDE.md"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${BLUE}"
    echo "  ╔═══════════════════════════════════════╗"
    echo "  ║           🏛 Hera Installer           ║"
    echo "  ║   AI Coding Agent Architecture Ref    ║"
    echo "  ╚═══════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

install_claude() {
    print_info "Installing for Claude Code..."
    if [ -f "$CLAUDE_FILE" ]; then
        if [ -f "CLAUDE.md" ]; then
            # Append if not already present
            if ! grep -q "Hera" CLAUDE.md 2>/dev/null; then
                cat "$CLAUDE_FILE" >> CLAUDE.md
                print_success "Appended Hera to CLAUDE.md"
            else
                print_warning "Hera already in CLAUDE.md"
            fi
        else
            cp "$CLAUDE_FILE" CLAUDE.md
            print_success "Created CLAUDE.md"
        fi
    fi
}

install_hermes() {
    print_info "Installing for Hermes Agent..."
    local target_dir="$HOME/.hermes/skills/hera"
    mkdir -p "$target_dir"
    cp "$SKILL_FILE" "$target_dir/SKILL.md"
    print_success "Installed to $target_dir/SKILL.md"
}

install_opencode() {
    print_info "Installing for OpenCode..."
    if [ -f "$AGENTS_FILE" ]; then
        if [ -f "AGENTS.md" ]; then
            if ! grep -q "Hera" AGENTS.md 2>/dev/null; then
                cat "$AGENTS_FILE" >> AGENTS.md
                print_success "Appended Hera to AGENTS.md"
            else
                print_warning "Hera already in AGENTS.md"
            fi
        else
            cp "$AGENTS_FILE" AGENTS.md
            print_success "Created AGENTS.md"
        fi
    fi
}

install_codex() {
    print_info "Installing for Codex..."
    install_opencode  # Same format
}

install_cursor() {
    print_info "Installing for Cursor..."
    local target_dir=".cursor/rules"
    mkdir -p "$target_dir"
    cp "$SCRIPT_DIR/.cursor/rules/hera.mdc" "$target_dir/hera.mdc"
    print_success "Installed to $target_dir/hera.mdc"
}

install_antigravity() {
    print_info "Installing for Google Antigravity..."
    local target_dir=".agents"
    mkdir -p "$target_dir/rules" "$target_dir/workflows"
    cp "$SCRIPT_DIR/.agents/rules/hera.md" "$target_dir/rules/hera.md"
    cp "$SCRIPT_DIR/.agents/workflows/hera.md" "$target_dir/workflows/hera.md"
    print_success "Installed to $target_dir/"
}

install_pi() {
    print_info "Installing for Pi coding agent..."
    local target_dir="$HOME/.pi/agent/skills/hera"
    mkdir -p "$target_dir"
    cp "$SKILL_FILE" "$target_dir/SKILL.md"
    print_success "Installed to $target_dir/SKILL.md"
}

install_gemini() {
    print_info "Installing for Gemini CLI..."
    if [ -f "$AGENTS_FILE" ]; then
        if [ -f "GEMINI.md" ]; then
            if ! grep -q "Hera" GEMINI.md 2>/dev/null; then
                cat "$AGENTS_FILE" >> GEMINI.md
                print_success "Appended Hera to GEMINI.md"
            else
                print_warning "Hera already in GEMINI.md"
            fi
        else
            cp "$AGENTS_FILE" GEMINI.md
            print_success "Created GEMINI.md"
        fi
    fi
}

install_aider() {
    print_info "Installing for Aider..."
    install_opencode  # Same format
}

install_copilot() {
    print_info "Installing for GitHub Copilot CLI..."
    local target_dir="$HOME/.copilot/skills/hera"
    mkdir -p "$target_dir"
    cp "$SKILL_FILE" "$target_dir/SKILL.md"
    print_success "Installed to $target_dir/SKILL.md"
}

install_amp() {
    print_info "Installing for Amp..."
    install_opencode  # Same format
}

install_kilo() {
    print_info "Installing for Kilo Code..."
    local target_dir=".kilo/skills/hera"
    mkdir -p "$target_dir"
    cp "$SKILL_FILE" "$target_dir/SKILL.md"
    print_success "Installed to $target_dir/SKILL.md"
}

install_kiro() {
    print_info "Installing for Kiro..."
    local target_dir=".kiro/skills/hera"
    mkdir -p "$target_dir"
    cp "$SKILL_FILE" "$target_dir/SKILL.md"
    print_success "Installed to $target_dir/SKILL.md"
}

install_devin() {
    print_info "Installing for Devin CLI..."
    local target_dir="$HOME/.config/devin/skills/hera"
    mkdir -p "$target_dir"
    cp "$SKILL_FILE" "$target_dir/SKILL.md"
    print_success "Installed to $target_dir/SKILL.md"
}

install_trae() {
    print_info "Installing for Trae..."
    install_opencode  # Same format
}

install_codebuddy() {
    print_info "Installing for CodeBuddy..."
    if [ -f "$AGENTS_FILE" ]; then
        if [ -f "CODEBUDDY.md" ]; then
            if ! grep -q "Hera" CODEBUDDY.md 2>/dev/null; then
                cat "$AGENTS_FILE" >> CODEBUDDY.md
                print_success "Appended Hera to CODEBUDDY.md"
            else
                print_warning "Hera already in CODEBUDDY.md"
            fi
        else
            cp "$AGENTS_FILE" CODEBUDDY.md
            print_success "Created CODEBUDDY.md"
        fi
    fi
}

install_claw() {
    print_info "Installing for OpenClaw..."
    install_opencode  # Same format
}

install_droid() {
    print_info "Installing for Factory Droid..."
    install_opencode  # Same format
}

install_all() {
    print_info "Installing for all detected agents..."
    install_claude
    install_hermes
    install_opencode
    install_codex
    install_cursor
    install_antigravity
    install_pi
    install_gemini
    install_aider
    install_copilot
    install_amp
    install_kilo
    install_kiro
    install_devin
    install_trae
    install_codebuddy
    install_claw
    install_droid
    print_success "Installed for all agents!"
}

show_help() {
    echo "Usage: ./install.sh <agent-name>"
    echo ""
    echo "Supported agents:"
    echo "  claude      - Claude Code"
    echo "  hermes      - Hermes Agent"
    echo "  opencode    - OpenCode"
    echo "  codex       - Codex"
    echo "  cursor      - Cursor"
    echo "  antigravity - Google Antigravity"
    echo "  pi          - Pi coding agent"
    echo "  gemini      - Gemini CLI"
    echo "  aider       - Aider"
    echo "  copilot     - GitHub Copilot CLI"
    echo "  amp         - Amp"
    echo "  kilo        - Kilo Code"
    echo "  kiro        - Kiro"
    echo "  devin       - Devin CLI"
    echo "  trae        - Trae"
    echo "  codebuddy   - CodeBuddy"
    echo "  claw        - OpenClaw"
    echo "  droid       - Factory Droid"
    echo "  all         - Install for all detected agents"
    echo ""
    echo "Examples:"
    echo "  ./install.sh claude"
    echo "  ./install.sh hermes"
    echo "  ./install.sh all"
}

# Main
print_banner

case "${1:-}" in
    claude)      install_claude ;;
    hermes)      install_hermes ;;
    opencode)    install_opencode ;;
    codex)       install_codex ;;
    cursor)      install_cursor ;;
    antigravity) install_antigravity ;;
    pi)          install_pi ;;
    gemini)      install_gemini ;;
    aider)       install_aider ;;
    copilot)     install_copilot ;;
    amp)         install_amp ;;
    kilo)        install_kilo ;;
    kiro)        install_kiro ;;
    devin)       install_devin ;;
    trae)        install_trae ;;
    codebuddy)   install_codebuddy ;;
    claw)        install_claw ;;
    droid)       install_droid ;;
    all)         install_all ;;
    -h|--help)   show_help ;;
    "")
        print_error "No agent specified!"
        echo ""
        show_help
        exit 1
        ;;
    *)
        print_error "Unknown agent: $1"
        echo ""
        show_help
        exit 1
        ;;
esac

echo ""
print_success "Hera installation complete!"
echo ""
print_info "Read SKILL.md for the complete architecture reference."
