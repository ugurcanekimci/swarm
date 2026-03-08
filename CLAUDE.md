# Swarm — Multi-Agent Knowledge Ingestion System

## Project
YouTube transcript + X/Twitter ingestion pipeline with Obsidian-backed knowledge base,
container-isolated agent swarm via NanoClaw, and hybrid local/cloud model routing.

## Stack
- Runtime: Node.js 20+, TypeScript (ES modules, strict)
- Framework: Hono (REST API, port 3100)
- Agent SDK: @anthropic-ai/claude-agent-sdk (MCP server)
- Schema: Zod 4 (all inputs/outputs validated)
- Knowledge Base: Obsidian vault at /Users/u/Documents/swarm-kb/
- Scraping: Crawl4AI (self-hosted) + Camoufox + residential proxies
- Models: Ollama local (qwen3-coder, glm-4.7, qwen3:8b) → Claude API (frontier)
- Container: NanoClaw (each agent in own Linux container)
- Tests: Vitest
- Build: tsc → dist/

## Architecture Rules
- Every agent gets its own container with minimal tool access
- YouTube transcripts + X posts are PRIMARY knowledge sources
- All content stored as Obsidian-compatible markdown with YAML frontmatter
- Context budget per tool result: max 4,000 tokens — truncate and link to full
- System prompts under 200 lines per agent
- Default to Tier 1 (local Ollama). Escalate only on failure or complexity.
- No Bright Data. Use Crawl4AI → Camoufox → Apify fallback cascade.
- No secrets in any agent-readable file. Environment variables only.

## Code Style
- Imports: node: prefix for builtins, .js extensions for local imports
- Error handling: let errors propagate, catch at API boundary (routes.ts)
- No classes unless modeling stateful resources (ProxyPool, IndexManager)
- Prefer async/await over .then() chains
- No default exports — named exports only
- Config via environment variables, centralized in config.ts

## Key Paths
- src/mcp/server.ts — MCP tool definitions (Claude Agent SDK)
- src/api/routes.ts — REST endpoints
- src/core/transcript.ts — YouTube fetching
- src/obsidian/vault.ts — Obsidian read/write
- src/x-twitter/fetcher.ts — X/Twitter ingestion
- src/scraping/router.ts — Web scraping decision router
- src/orchestrator/index.ts — Agent swarm orchestrator
- src/context/truncator.ts — Token budget enforcement

## Commands
- npm run dev — Watch mode (tsx)
- npm run build — Compile to dist/
- npm test — Vitest
- npm run mcp — MCP stdio server
- docker compose up -d — Start Crawl4AI + Camoufox stack
