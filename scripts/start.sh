#!/bin/bash
# Swarm PoC — End-to-End Startup Script
#
# This is the single entry point for starting the entire swarm stack.
# It injects 1Password secrets, configures NanoClaw groups, starts
# services, and launches NanoClaw.
#
# Prerequisites:
#   - 1Password CLI: op signin
#   - Docker: running
#   - NanoClaw: cloned at /Users/u/nanoclaw with npm install done
#   - Swarm: npm install done
#
# Usage: ./scripts/start.sh

set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

SWARM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NANOCLAW_DIR="/Users/u/nanoclaw"
VAULT_DIR="/Users/u/Documents/swarm-kb"

echo "=== Swarm PoC Startup ==="
echo "Swarm:    $SWARM_DIR"
echo "NanoClaw: $NANOCLAW_DIR"
echo "Vault:    $VAULT_DIR"
echo ""

# ─── Step 0: Prerequisites ───────────────────────────────────────────

echo "[0/6] Checking prerequisites..."

errors=0

if ! command -v op &>/dev/null; then
  echo "  ERROR: 1Password CLI (op) not found. Install: brew install --cask 1password-cli"
  errors=$((errors + 1))
fi

if ! command -v docker &>/dev/null; then
  echo "  ERROR: Docker not found."
  errors=$((errors + 1))
elif ! docker info &>/dev/null 2>&1; then
  echo "  ERROR: Docker not running. Start Docker Desktop first."
  errors=$((errors + 1))
fi

if ! command -v node &>/dev/null; then
  echo "  ERROR: Node.js not found."
  errors=$((errors + 1))
fi

if [ ! -d "$NANOCLAW_DIR/src" ]; then
  echo "  ERROR: NanoClaw not found at $NANOCLAW_DIR"
  errors=$((errors + 1))
fi

if [ $errors -gt 0 ]; then
  echo ""
  echo "Fix the above errors and re-run."
  exit 1
fi

echo "  All prerequisites OK"
echo ""

# ─── Step 1: 1Password → .env ────────────────────────────────────────

echo "[1/6] Injecting secrets from 1Password (Swarm vault only)..."

if ! op whoami &>/dev/null 2>&1; then
  echo "  1Password not authenticated. Attempting sign-in..."
  op signin
fi

# Verify we can access the Swarm vault specifically
if ! op vault get Swarm &>/dev/null 2>&1; then
  echo "  ERROR: 'Swarm' vault not found in 1Password."
  echo "  Run: ./scripts/op-setup.sh"
  exit 1
fi

op inject -i "$SWARM_DIR/config/nanoclaw.env.tpl" -o "$NANOCLAW_DIR/.env" --force
echo "  Secrets injected into $NANOCLAW_DIR/.env"

# Refresh Claude Code OAuth token from macOS Keychain
KEYCHAIN_CREDS=$(security find-generic-password -s 'Claude Code-credentials' -w 2>/dev/null || true)
if [ -n "$KEYCHAIN_CREDS" ]; then
  OAUTH_TOKEN=$(echo "$KEYCHAIN_CREDS" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d['claudeAiOauth']['accessToken'])" 2>/dev/null || true)
  if [ -n "$OAUTH_TOKEN" ]; then
    if grep -q "^CLAUDE_CODE_OAUTH_TOKEN=" "$NANOCLAW_DIR/.env"; then
      sed -i '' "s|^CLAUDE_CODE_OAUTH_TOKEN=.*|CLAUDE_CODE_OAUTH_TOKEN=${OAUTH_TOKEN}|" "$NANOCLAW_DIR/.env"
    else
      echo "CLAUDE_CODE_OAUTH_TOKEN=${OAUTH_TOKEN}" >> "$NANOCLAW_DIR/.env"
    fi
    echo "  OAuth token refreshed from Keychain"
  else
    echo "  WARNING: Could not extract OAuth token from Keychain"
  fi
else
  echo "  WARNING: No Claude Code credentials in Keychain (run: claude auth login)"
fi
echo ""

# ─── Step 2: Mount Allowlist ─────────────────────────────────────────

echo "[2/6] Installing mount allowlist..."

ALLOWLIST_DIR="$HOME/.config/nanoclaw"
mkdir -p "$ALLOWLIST_DIR"
cp "$SWARM_DIR/config/mount-allowlist.json" "$ALLOWLIST_DIR/mount-allowlist.json"
echo "  Installed at $ALLOWLIST_DIR/mount-allowlist.json"
echo ""

# ─── Step 3: Obsidian Vault ──────────────────────────────────────────

echo "[3/6] Ensuring Obsidian vault structure..."

mkdir -p "$VAULT_DIR"/{youtube,x-posts,research,changelogs,agents,_index,_templates}
echo "  Vault directories OK at $VAULT_DIR"
echo ""

# ─── Step 4: Group Setup ─────────────────────────────────────────────

echo "[4/6] Pre-seeding group configs..."

bash "$SWARM_DIR/scripts/setup-groups.sh" "$NANOCLAW_DIR"
echo ""

# ─── Step 5: Docker Services ─────────────────────────────────────────

echo "[5/6] Starting Docker services..."

cd "$SWARM_DIR"

# Crawl4AI is on-demand only — not auto-started.
# The scraping router handles graceful fallback when unavailable.
# To start manually: docker compose --profile scraping up crawl4ai -d
echo "  Crawl4AI: on-demand (start with: docker compose --profile scraping up crawl4ai -d)"

echo ""

# ─── Step 6: Start NanoClaw ──────────────────────────────────────────

echo "[6/6] Starting NanoClaw..."
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Swarm stack ready. NanoClaw starting below."
echo "  Send messages in #swarm-main on Slack."
echo "═══════════════════════════════════════════════════"
echo ""

cd "$NANOCLAW_DIR"
exec npm start
