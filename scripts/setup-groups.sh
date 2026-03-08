#!/bin/bash
# Pre-seed NanoClaw per-group configs for the swarm.
# Run BEFORE starting NanoClaw so containers get swarm MCP tools.
#
# What this does:
# 1. Copies agent-runner source per group and patches allowedTools
# 2. Creates settings.json per group with swarm MCP server config
#
# Usage: ./scripts/setup-groups.sh [/path/to/nanoclaw]

set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

SWARM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NANOCLAW_DIR="${1:-/Users/u/nanoclaw}"

if [ ! -d "$NANOCLAW_DIR/container/agent-runner/src" ]; then
  echo "ERROR: NanoClaw not found at $NANOCLAW_DIR"
  echo "Usage: $0 [/path/to/nanoclaw]"
  exit 1
fi

SESSIONS_DIR="$NANOCLAW_DIR/data/sessions"
AGENT_RUNNER_TEMPLATE="$NANOCLAW_DIR/container/agent-runner/src"
SETTINGS_TEMPLATE="$SWARM_DIR/config/settings-base.json"

# All swarm group folders
GROUPS=(
  slack_swarm-main
  slack_swarm-ingest
  slack_swarm-research
  slack_swarm-coder
  slack_swarm-review
)

echo "=== Swarm Group Setup ==="
echo "NanoClaw: $NANOCLAW_DIR"
echo "Swarm:    $SWARM_DIR"
echo ""

for group in "${GROUPS[@]}"; do
  echo "[$group]"

  # --- 1. Agent-runner source with allowedTools patch ---
  target="$SESSIONS_DIR/$group/agent-runner-src"
  if [ -d "$target" ]; then
    echo "  agent-runner-src/ exists — checking patch..."
  else
    echo "  Copying agent-runner source..."
    mkdir -p "$target"
    cp "$AGENT_RUNNER_TEMPLATE"/* "$target/" 2>/dev/null || true
    # Also copy subdirectories if any
    for sub in "$AGENT_RUNNER_TEMPLATE"/*/; do
      [ -d "$sub" ] && cp -r "$sub" "$target/"
    done
  fi

  # Apply patch: add mcp__swarm__* to allowedTools if not already present
  index_file="$target/index.ts"
  if [ -f "$index_file" ]; then
    if grep -q "mcp__swarm__" "$index_file" 2>/dev/null; then
      echo "  allowedTools already patched"
    else
      # Patch: add 'mcp__swarm__*' after 'mcp__nanoclaw__*'
      sed "s/'mcp__nanoclaw__\*'/'mcp__nanoclaw__*',\n        'mcp__swarm__*'/" \
        "$index_file" > "$index_file.tmp" && mv "$index_file.tmp" "$index_file"
      echo "  Patched allowedTools with mcp__swarm__*"
    fi
  else
    echo "  WARNING: index.ts not found in agent-runner-src"
  fi

  # --- 2. Settings.json with swarm MCP server ---
  settings_dir="$SESSIONS_DIR/$group/.claude"
  settings_file="$settings_dir/settings.json"
  mkdir -p "$settings_dir"

  if [ -f "$settings_file" ]; then
    # Check if swarm MCP already configured
    if grep -q '"swarm"' "$settings_file" 2>/dev/null; then
      echo "  settings.json already has swarm MCP"
    else
      echo "  Merging swarm MCP into existing settings.json..."
      # Use node to merge JSON (jq not guaranteed)
      node -e "
        const fs = require('fs');
        const existing = JSON.parse(fs.readFileSync('$settings_file', 'utf8'));
        const swarm = JSON.parse(fs.readFileSync('$SETTINGS_TEMPLATE', 'utf8'));
        // Merge env
        existing.env = { ...existing.env, ...swarm.env };
        // Merge mcpServers
        existing.mcpServers = { ...(existing.mcpServers || {}), ...swarm.mcpServers };
        // Merge permissions
        if (swarm.permissions) {
          existing.permissions = existing.permissions || {};
          existing.permissions.allow = [
            ...(existing.permissions.allow || []),
            ...(swarm.permissions.allow || [])
          ];
        }
        fs.writeFileSync('$settings_file', JSON.stringify(existing, null, 2) + '\n');
      "
      echo "  Merged swarm MCP config"
    fi
  else
    echo "  Creating settings.json with swarm MCP..."
    cp "$SETTINGS_TEMPLATE" "$settings_file"
  fi

  echo ""
done

echo "=== Group Setup Complete ==="
echo ""
echo "All $((${#GROUPS[@]})) groups pre-seeded with:"
echo "  - agent-runner-src/ with mcp__swarm__* in allowedTools"
echo "  - settings.json with swarm MCP server config"
