#!/bin/bash
# 1Password Vault Setup for Swarm
# Creates the dedicated "Swarm" vault and empty items.
# ONLY accesses the Swarm vault — never the personal vault.
#
# Prerequisites: op signin (authenticate first)
# Usage: ./scripts/op-setup.sh

set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

echo "=== 1Password Swarm Vault Setup ==="

# Check op is authenticated
if ! op whoami &>/dev/null; then
  echo "ERROR: Not signed in to 1Password CLI."
  echo "Run: op signin"
  exit 1
fi

VAULT="Swarm"

# Create vault if it doesn't exist
if ! op vault get "$VAULT" &>/dev/null 2>&1; then
  echo "[1/4] Creating vault '$VAULT'..."
  op vault create "$VAULT" --description "NanoClaw Swarm agent secrets (isolated from personal)"
else
  echo "[1/4] Vault '$VAULT' already exists"
fi

# Helper: create an item if it doesn't exist
create_item() {
  local title="$1"
  shift
  if op item get "$title" --vault "$VAULT" &>/dev/null 2>&1; then
    echo "  Item '$title' already exists — skipping (edit manually if needed)"
  else
    echo "  Creating item '$title'..."
    op item create --vault "$VAULT" --category=login --title="$title" "$@"
  fi
}

# 2. Claude / Anthropic credentials
echo "[2/4] Creating Anthropic credentials..."
create_item "anthropic" \
  "api-key[password]=" \
  "oauth-token[password]=" \
  "base-url[text]=https://api.anthropic.com"

# 3. Slack credentials
echo "[3/4] Creating Slack credentials..."
create_item "slack" \
  "bot-token[password]=" \
  "app-token[password]="

# 4. Optional service credentials
echo "[4/4] Creating optional service credentials..."
create_item "apify" \
  "api-token[password]="

create_item "proxy" \
  "host[text]=" \
  "port[text]=" \
  "username[text]=" \
  "password[password]="

echo ""
echo "=== Vault Setup Complete ==="
echo ""
echo "Next: populate secrets in 1Password (UI or CLI):"
echo "  op item edit anthropic --vault Swarm 'api-key=sk-ant-api03-YOUR-KEY'"
echo "  op item edit slack --vault Swarm 'bot-token=xoxb-YOUR-TOKEN'"
echo "  op item edit slack --vault Swarm 'app-token=xapp-YOUR-TOKEN'"
echo ""
echo "Then run: ./scripts/start.sh"
