# NanoClaw Swarm Configuration
# This template is rendered by `op inject` at startup.
# References like {{ op://Swarm/... }} are replaced with actual values
# from the dedicated "Swarm" vault in 1Password.
#
# NEVER commit the rendered .env — only this .tpl template.

# Claude API credentials (exactly one of these is required)
ANTHROPIC_API_KEY={{ op://Swarm/anthropic/api-key }}
# CLAUDE_CODE_OAUTH_TOKEN={{ op://Swarm/anthropic/oauth-token }}

# Slack credentials
SLACK_BOT_TOKEN={{ op://Swarm/slack/bot-token }}
SLACK_APP_TOKEN={{ op://Swarm/slack/app-token }}

# Assistant identity
ASSISTANT_NAME=Swarm

# Container settings
MAX_CONCURRENT_CONTAINERS=5
IDLE_TIMEOUT=1800000
CONTAINER_TIMEOUT=1800000

# Timezone
TZ=America/Los_Angeles
