# Swarm Implementation Plan

*NanoClaw Multi-Agent System with YouTube/X Ingestion + Obsidian Knowledge Base*

*Last updated: 2026-03-09*

---

## Current State (as of 2026-03-09)

### ✅ Implemented

**swarm-project** (`/workspace/extra/swarm-project`):
- Hono REST API (port 3100) with full ingest + KB + scheduler endpoints
- MCP server v2.0 with 13 tools (see below)
- Obsidian vault integration (`src/obsidian/`) — vault.ts, index-manager.ts, query.ts, moc.ts
- YouTube ingestion pipeline (`src/ingest/youtube.ts`) — transcript fetch + Obsidian storage
- X/Twitter ingestion pipeline (`src/ingest/x-twitter.ts`) — Nitter → Apify cascade
- Direct cron scheduler (`src/scheduler/`) — node-cron based, no LLM needed, history tracking
- Flexible source config (`src/ingest/sources.ts`) — runtime-editable via `data/sources.json`
- Ingestion cycle runner (`src/ingest/cycle.ts`) — orchestrates full X and YouTube cycles
- Context optimization (`src/context/`) — truncator.ts, summarizer.ts
- Orchestrator (`src/orchestrator/`) — index.ts, router.ts, model-router.ts
- Scraping stack (`src/scraping/`) — crawl4ai-client.ts, proxy-pool.ts, router.ts
- Startup script (`scripts/start.sh`) — swarm API + scheduler bootstrap

**MCP Tools (13 total):**

| Tool | Purpose |
|------|---------|
| `fetch_transcript` | YouTube → Obsidian vault (truncated for LLM) |
| `batch_fetch_transcripts` | Bulk YouTube ingest |
| `fetch_tweet` | X/Twitter tweet/thread → Obsidian |
| `fetch_user_timeline` | X user timeline → Obsidian |
| `search_tweets` | X keyword search → Obsidian |
| `kb_search` | Full-text + frontmatter search across vault |
| `kb_recent` | Recent entries by type |
| `kb_by_tag` | Entries by tag |
| `kb_write` | Write research note to vault |
| `kb_read` | Read a vault note by filename |
| `web_scrape` | Crawl4AI single-page scrape → markdown |
| `plan_task` | Route task to appropriate agent |
| `cost_report` | Token spend tracking |

**nanoclaw** (`/workspace/extra/nanoclaw`):
- Slack channel (`src/channels/slack.ts`) — Socket Mode, self-registers at startup
- Swarm group config (`swarm-groups.json`) — 5 agent groups defined
- Setup scripts (`swarm-setup.sh`, `swarm-mcp-setup.md`) — MCP + group registration
- Global agent instructions (`groups/global/CLAUDE.md`) — swarm-aware defaults
- Ollama MCP stdio server (`container/agent-runner/src/ollama-mcp-stdio.ts`) — local model access from container
- Updated agent runner (`container/agent-runner/src/index.ts`) — Ollama tool support, expanded allowedTools
- Ollama watch script (`scripts/ollama-watch.sh`) — monitors Ollama availability

### 🔄 Partially Implemented

- **X/Twitter scraping**: Nitter → Apify cascade works; Crawl4AI+Camoufox path not yet integrated
- **Scraping stack**: Crawl4AI client + proxy pool implemented; `camoufox-client.ts` not yet created
- **Phase 9 (NanoClaw integration)**: `swarm-setup.sh` covers group setup; 1Password `op inject` flow not yet implemented
- **Agent container CLAUDE.md files**: Only `groups/global/CLAUDE.md` updated; per-agent configs need refinement

### ❌ Not Yet Implemented

- `camoufox-client.ts` — Python subprocess wrapper for Camoufox anti-detect browser
- 1Password `op inject` secret injection flow (`config/nanoclaw.env.tpl`, `scripts/op-setup.sh`)
- `config/settings-base.json` — pre-seeded settings.json template for agent groups
- `config/mount-allowlist.json` — NanoClaw mount security config
- Per-agent CLAUDE.md files (ingest, research, review, ops agent groups)
- RSS / GitHub / Substack ingestion (sources defined, ingest functions not written)
- MOC auto-generation trigger (moc.ts exists, needs wiring into vault writes)
- Agent memory compaction (summarizer exists, compaction loop not wired)

---

## Architecture

```
/workspace/extra/swarm-project/  ← orchestrator + API + MCP server
/workspace/extra/swarm-kb/       ← Obsidian vault (shared knowledge base)
/workspace/extra/nanoclaw/       ← NanoClaw runtime (swarm customized)

┌─────────────────────────────────────────────────────────────────┐
│                        SWARM ORCHESTRATOR                       │
│                     src/orchestrator/index.ts                    │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ │
│  │ Ingest   │ │ Research │ │  Coder   │ │ Review │ │  Ops   │ │
│  │ Agent    │ │ Agent    │ │  Agent   │ │ Agent  │ │ Agent  │ │
│  │ #ingest  │ │ #research│ │ #coder   │ │#review │ │ #ops   │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ └───┬────┘ │
│       │            │            │            │          │      │
│       └────────────┴────────────┴────────────┴──────────┘      │
│                              │                                  │
│                    ┌─────────┴─────────┐                        │
│                    │  Obsidian Vault    │                        │
│                    │  swarm-kb/         │                        │
│                    │  ├── youtube/      │                        │
│                    │  ├── x-posts/      │                        │
│                    │  ├── research/     │                        │
│                    │  ├── changelogs/   │                        │
│                    │  └── _index/       │                        │
│                    └───────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘

Model Routing:
  Tier 1 (free):   Ollama local → qwen3-coder:30b, glm-4.7, qwen3:8b
  Tier 2 (cheap):  Ollama cloud → minimax-m2.5:cloud, qwen3-coder:480b-cloud
  Tier 3 (frontier): Claude Opus/Sonnet 4.6 → architecture, security, complex reasoning
```

---

## Source Layout (current)

```
src/
├── obsidian/
│   ├── vault.ts              ✅ Obsidian vault read/write operations
│   ├── index-manager.ts      ✅ JSON index manager
│   ├── query.ts              ✅ Compound search across vault
│   └── moc.ts                ✅ Auto-generate Map of Content (needs wiring)
├── ingest/
│   ├── sources.ts            ✅ Source config (runtime-editable JSON)
│   ├── cycle.ts              ✅ Ingestion cycle orchestrator
│   ├── youtube.ts            ✅ YouTube ingest → Obsidian
│   └── x-twitter.ts         ✅ X/Twitter ingest (Nitter → Apify)
├── scheduler/
│   ├── index.ts              ✅ node-cron scheduler, job registry
│   └── history.ts            ✅ Run history persistence
├── x-twitter/
│   └── fetcher.ts            ✅ X fetch cascade (simplified, Nitter → Apify)
├── scraping/
│   ├── router.ts             ✅ 5-layer scraping decision router
│   ├── crawl4ai-client.ts    ✅ Crawl4AI TypeScript client
│   └── proxy-pool.ts         ✅ Multi-provider proxy rotation
├── context/
│   ├── truncator.ts          ✅ Token budget enforcement
│   └── summarizer.ts         ✅ Auto-summary generation
├── orchestrator/
│   ├── index.ts              ✅ Task planning + cost tracking
│   ├── router.ts             ✅ Task → agent routing
│   └── model-router.ts       ✅ Task complexity → model selection
├── api/
│   └── routes.ts             ✅ REST endpoints (ingest, KB, scheduler, scrape)
├── mcp/
│   └── server.ts             ✅ 13 MCP tools
├── core/
│   ├── transcript.ts         ✅ YouTube transcript fetching
│   └── batch.ts              ✅ Batch processing with concurrency
├── config.ts                 ✅ Centralized config
├── types.ts                  ✅ Shared types
└── index.ts                  ✅ Hono app entry point

scripts/
└── start.sh                  ✅ Startup script (API + scheduler)
```

---

## Remaining Work (prioritized)

### Next: Complete NanoClaw Integration

1. **Per-agent CLAUDE.md files** — create agent-specific instruction files for each Slack group (swarm-ingest, swarm-research, swarm-review, swarm-ops)
2. **`config/settings-base.json`** — pre-seeded settings.json with swarm MCP config + `mcp__swarm__*` permissions
3. **`config/mount-allowlist.json`** — NanoClaw mount security config for swarm-kb and swarm-project
4. **1Password integration** — `scripts/op-setup.sh` + `config/nanoclaw.env.tpl` for secret injection

### Then: Fill Scraping Gaps

5. **`camoufox-client.ts`** — Python subprocess wrapper for heavy anti-detect scraping
6. **Wire Camoufox into scraping router** — currently Crawl4AI → Apify, skipping Camoufox tier
7. **RSS/GitHub/Substack ingestion** — source types defined, ingest functions missing

### Then: Automation

8. **MOC auto-generation** — call `generateMoc()` after each vault write
9. **Agent memory compaction** — wire `summarizer.ts` into a scheduled compaction loop
10. **Scheduled YouTube ingestion** — `src/ingest/cycle.ts` has X covered, add YouTube cycle

---

## Cost Projection (Monthly)

| Component | Cost |
|-----------|------|
| Ollama local (qwen3-coder, glm-4.7, qwen3) | $0 |
| Ollama cloud (minimax-m2.5 for complex code) | ~$5-15 |
| Claude Sonnet 4.6 (reviews, synthesis) | ~$10-30 |
| Claude Opus 4.6 (architecture, rare) | ~$5-15 |
| Residential proxies (2-5 GB) | ~$5-12 |
| CapSolver (CAPTCHA, rare) | ~$1-2 |
| Apify (fallback scrapers) | $0-5 |
| **Total** | **~$26-79/month** |

vs. Bright Data + full Claude API routing: **$200-500/month**

---

## Operation Commands

```bash
# Start swarm API + scheduler
cd /workspace/extra/swarm-project && npm run dev

# Start MCP server (stdio, for Claude Code/Desktop)
npm run mcp

# Add a YouTube source
curl -X POST http://localhost:3100/api/sources \
  -H "Content-Type: application/json" \
  -d '{"type":"youtube","channelId":"UCxxxxxx","name":"Channel Name","tags":["tag1"],"schedule":"0 */6 * * *"}'

# Trigger immediate X ingestion cycle
curl -X POST http://localhost:3100/api/ingest/run-cycle

# Search knowledge base
curl "http://localhost:3100/api/kb/search?q=bevy+rapier"

# Check scheduler status
curl http://localhost:3100/api/scheduler/status

# Check cost report
curl http://localhost:3100/api/orchestrator/cost
```
