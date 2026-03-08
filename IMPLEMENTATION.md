# Swarm Implementation Plan

*NanoClaw Multi-Agent System with YouTube/X Ingestion + Obsidian Knowledge Base*

---

## Current State

Working `swarm-youtube-transcript` project with:
- Hono REST API (port 3100) for YouTube transcript fetching
- Claude Agent SDK MCP server with 5 tools
- Apify fallback for transcript failures
- File-based knowledge base (markdown + JSON index)
- Text cleaning pipeline (entity decode, filler removal, paragraph detection)
- Batch processing with concurrency control
- Docker-ready (multi-stage Node 20 Alpine)

## Target State

A **5-agent container-isolated swarm** that:
1. Ingests YouTube transcripts + X/Twitter posts as primary knowledge sources
2. Stores everything in a **shared Obsidian vault** with YAML frontmatter
3. Scrapes the web using **Crawl4AI + Camoufox + residential proxies** (zero Bright Data)
4. Routes models by cost tier: **local Ollama -> Ollama Cloud -> Claude API**
5. Optimizes context to minimize token spend per agent turn

---

## Architecture

```
/Users/u/swarm/                          ← this project (orchestrator + APIs)
/Users/u/Documents/swarm-kb/             ← Obsidian vault (shared knowledge base)
~/nanoclaw/                              ← NanoClaw runtime (to be cloned)

┌─────────────────────────────────────────────────────────────────┐
│                        SWARM ORCHESTRATOR                       │
│                     src/orchestrator/index.ts                    │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ │
│  │ Ingest   │ │ Research │ │  Coder   │ │ Review │ │  Ops   │ │
│  │ Agent    │ │ Agent    │ │  Agent   │ │ Agent  │ │ Agent  │ │
│  │          │ │          │ │          │ │        │ │        │ │
│  │ YT+X     │ │ Crawl4AI │ │ code gen │ │ PR/QA  │ │ builds │ │
│  │ ingest   │ │ Camoufox │ │ refactor │ │ audit  │ │ deploy │ │
│  │ → Obsid  │ │ Apify    │ │ git ops  │ │ review │ │ cron   │ │
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
│                    │  ├── agents/       │                        │
│                    │  └── _index/       │                        │
│                    └───────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘

Model Routing:
  Tier 1 (free):   Ollama local → qwen3-coder:30b, glm-4.7, qwen3:8b
  Tier 2 (cheap):  Ollama cloud → minimax-m2.5:cloud, qwen3-coder:480b-cloud
  Tier 3 (frontier): Claude Opus/Sonnet 4.6 → architecture, security, complex reasoning
```

---

## Phase 1: Foundation (Days 1-2)

### 1A. Initialize Git + CLAUDE.md

```bash
cd /Users/u/swarm
git init
git add -A
git commit -m "Initial commit: YouTube transcript API + MCP server"
```

### 1B. Create Obsidian Vault for Swarm KB

```bash
mkdir -p /Users/u/Documents/swarm-kb/{youtube,x-posts,research,agents,_index,_templates}
```

Open Obsidian → "Open folder as vault" → `/Users/u/Documents/swarm-kb/`

Vault structure:
```
swarm-kb/
├── .obsidian/              ← Obsidian config (auto-created)
├── youtube/                ← YouTube transcripts as .md
│   └── {videoId}.md        ← YAML frontmatter + cleaned transcript
├── x-posts/                ← X/Twitter threads as .md
│   └── {tweetId}.md        ← YAML frontmatter + thread content
├── research/               ← Web research results
│   └── {topic}-{date}.md   ← Crawl4AI output, curated
├── agents/                 ← Agent memory files
│   ├── ingest.md           ← Ingest agent state
│   ├── research.md         ← Research agent state
│   ├── coder.md            ← Coder agent state
│   └── orchestrator.md     ← Orchestrator decisions log
├── _index/                 ← Machine-readable indexes
│   ├── youtube.json        ← Video index (replaces data/transcripts/index.json)
│   ├── x-posts.json        ← Tweet index
│   └── sources.json        ← Master source registry
├── _templates/             ← Obsidian templates
│   ├── youtube.md          ← Template for YT transcripts
│   └── x-post.md           ← Template for X posts
└── MOC.md                  ← Map of Content (auto-generated)
```

### 1C. Clone NanoClaw

```bash
cd ~
git clone https://github.com/qwibitai/nanoclaw.git
cd nanoclaw
# Follow NanoClaw setup via Claude Code
```

### 1D. Verify Ollama Models

```bash
ollama serve &

# Pull required models
ollama pull qwen3-coder:30b
ollama pull glm-4.7
ollama pull qwen3:8b

# Verify API
curl http://localhost:11434/v1/models
```

---

## Phase 2: Obsidian Integration Layer (Days 2-3)

### New file: `src/obsidian/vault.ts`

Replace the current file-based KB store with an Obsidian-native store. All content writes become Obsidian-compatible markdown with YAML frontmatter, wikilinks, and tags.

**Key changes:**
- `config.obsidianVault` → path to `/Users/u/Documents/swarm-kb/`
- Store YouTube transcripts in `youtube/{videoId}.md`
- Store X posts in `x-posts/{tweetId}.md`
- Store research in `research/{slug}.md`
- Maintain JSON indexes in `_index/` for fast programmatic lookups
- Auto-generate `MOC.md` (Map of Content) on each write
- Use Obsidian `[[wikilinks]]` for cross-referencing between notes

**Obsidian frontmatter schema (YouTube):**
```yaml
---
type: youtube-transcript
videoId: "dQw4w9WgXcQ"
title: "Video Title"
channel: "Channel Name"
url: "https://youtube.com/watch?v=dQw4w9WgXcQ"
language: en
duration: 212
wordCount: 1847
fetchedAt: 2026-03-08T10:00:00Z
tags: [bevy, rust, game-dev]
sources: []
---
```

**Obsidian frontmatter schema (X post):**
```yaml
---
type: x-post
tweetId: "1234567890"
author: "@handle"
authorName: "Display Name"
url: "https://x.com/handle/status/1234567890"
isThread: true
tweetCount: 5
fetchedAt: 2026-03-08T10:00:00Z
tags: [ai, agents, nanoclaw]
relatedVideos: []
---
```

### New file: `src/obsidian/index-manager.ts`

Drop-in replacement for current `knowledge-base/index-manager.ts` that reads/writes to `swarm-kb/_index/`.

### New file: `src/obsidian/query.ts`

Enhanced search that:
1. Searches YAML frontmatter fields (type, tags, channel, author)
2. Full-text content search
3. Returns Obsidian `[[wikilink]]` paths for cross-reference
4. Supports compound queries: `type:youtube channel:"3Blue1Brown" tag:math`

### New file: `src/obsidian/moc.ts`

Auto-generates `MOC.md` (Map of Content):
```markdown
# Swarm Knowledge Base

## Recent (last 7 days)
- [[youtube/abc123]] - "Bevy ECS Deep Dive" (3Blue1Brown)
- [[x-posts/456789]] - Thread by @bevyengine on 0.15 release

## By Source
### YouTube (47 transcripts)
- [[youtube/abc123]] - "Bevy ECS Deep Dive"
...

### X/Twitter (23 threads)
- [[x-posts/456789]] - @bevyengine thread
...

## By Tag
### #bevy (12 notes)
### #rust (8 notes)
### #ai-agents (15 notes)
```

---

## Phase 3: X/Twitter Ingestion Pipeline (Days 3-5)

### Strategy: Zero Bright Data, Zero Official API

The X API costs $100/month minimum (Basic tier) and provides limited access. Instead:

**Tier 1 — Nitter instances (free, fragile):**
Nitter is an open-source Twitter frontend that exposes RSS feeds. No auth needed.

```
https://nitter.net/{user}/rss          ← user timeline RSS
https://nitter.net/{user}/status/{id}  ← single tweet page
https://nitter.net/search?q={query}    ← search
```

Nitter instances rotate — maintain a health-checked pool.

**Tier 2 — Crawl4AI + Camoufox (reliable, costs proxy bandwidth):**
For when Nitter is down or blocked. Crawl4AI renders the X page with Camoufox
(anti-detect browser), extracts thread content as clean markdown.

**Tier 3 — Apify Twitter Scraper (reliable, costs Apify credits):**
`apify/twitter-scraper` actor — use as last resort when self-hosted fails.

### New file: `src/x-twitter/fetcher.ts`

```
Nitter RSS (free) → Crawl4AI+Camoufox (proxy cost) → Apify (credits)
```

**Capabilities:**
- Fetch single tweet/thread by URL
- Fetch user timeline (last N tweets)
- Search tweets by keyword
- Extract full threads (follow reply chains)
- Parse embedded media links, quote tweets
- Clean to markdown, strip tracking params

### New file: `src/x-twitter/nitter.ts`

Pool of Nitter instances with health checking:
```typescript
const NITTER_INSTANCES = [
  "https://nitter.net",
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
  // Add more — instances rotate
];
```

Fetch RSS feed, parse XML, extract tweet text + metadata.
Fallback cascade: try each instance, then escalate to Crawl4AI.

### New file: `src/x-twitter/thread-resolver.ts`

Given a tweet URL, resolve the full thread:
1. Fetch the tweet page (Nitter or Crawl4AI)
2. Follow `in_reply_to` chain upward to find thread root
3. Follow replies downward from root to get full thread
4. Concatenate into single markdown document
5. Store in `swarm-kb/x-posts/{rootTweetId}.md`

### New file: `src/x-twitter/parser.ts`

Clean X content:
- Strip t.co tracking URLs → resolve to real URLs
- Convert @mentions to `[@handle](https://x.com/handle)`
- Convert #hashtags to Obsidian `#tags`
- Extract embedded image/video URLs
- Handle quote tweets as blockquotes
- Remove "Replying to @user" noise

### MCP tools to add (in `src/mcp/server.ts`):

```
fetch_tweet        - Fetch single tweet or thread by URL
fetch_user_timeline - Fetch recent tweets from a user
search_tweets      - Search X by keyword
```

---

## Phase 4: Web Scraping Stack — Bright Data Alternatives (Days 4-6)

### 4A. Deploy Crawl4AI

```bash
docker pull unclecode/crawl4ai:latest
docker run -d --name crawl4ai -p 11235:11235 unclecode/crawl4ai:latest

# Register as MCP server for Claude Code
claude mcp add --transport sse crawl4ai http://localhost:11235/mcp/sse
```

### 4B. Install Camoufox

```bash
pip install camoufox
python -m camoufox fetch  # Downloads anti-detect browser binary
```

### 4C. Residential Proxy Setup

Sign up for IPRoyal or Thordata ($1.75-2.50/GB). Configure:

```bash
# Add to .env
PROXY_HOST=gate.iproyal.com
PROXY_PORT=12321
PROXY_USER=your_user
PROXY_PASS=your_pass
```

### New file: `src/scraping/router.ts`

Implements the 5-layer routing decision from the PRD:

```
Is it YouTube/X?
  → Use dedicated fetchers (Phase 2-3)

Is it a public, unprotected site?
  → Crawl4AI direct (free, fast)

Light protection (basic Cloudflare)?
  → Crawl4AI + residential proxy rotation

Heavy protection (Cloudflare Enterprise, DataDome)?
  → Camoufox + residential proxy + GeoIP

CAPTCHA encountered?
  → CapSolver API (last resort, ~$0.001/solve)

Structured platform data (Amazon, LinkedIn)?
  → Apify Actor (if one exists)
```

### New file: `src/scraping/crawl4ai-client.ts`

TypeScript client for the self-hosted Crawl4AI instance:
- `scrape(url)` → single page to markdown
- `crawl(url, depth)` → multi-page BFS
- `crawlSitemap(sitemapUrl)` → full site crawl
- Automatic proxy injection when configured
- Token counting on output (reject if >4000 tokens, summarize first)

### New file: `src/scraping/camoufox-client.ts`

Python subprocess wrapper (Camoufox is Python-only):
- Spawns Camoufox process with proxy + GeoIP config
- Returns clean HTML → pipes through Crawl4AI markdown extractor
- Session management (sticky sessions for multi-page)
- Fingerprint rotation per request

### New file: `src/scraping/proxy-pool.ts`

```typescript
interface ProxyEndpoint {
  provider: "iproyal" | "thordata" | "smartproxy";
  host: string;
  port: number;
  user: string;
  pass: string;
  type: "rotating" | "sticky";
  region?: string;
}

class ProxyPool {
  next(): ProxyEndpoint        // Round-robin
  sticky(sessionId: string)    // Same IP for multi-page
  regional(country: string)    // Geo-targeted
  healthCheck(): Promise<void> // Verify pool health
  markFailed(proxy: ProxyEndpoint): void
}
```

### Cost comparison (monthly, ~10K pages):

| Component | Bright Data | Our Stack |
|-----------|------------|-----------|
| Scraping engine | $50-150 | $0 (Crawl4AI) |
| Anti-detect browser | included | $0 (Camoufox) |
| Proxies | included | $5-12 (IPRoyal) |
| CAPTCHAs | included | $0.50-1 (CapSolver) |
| **Total** | **$50-150** | **$5-13** |

---

## Phase 5: Agent Swarm Definition (Days 5-8)

### 5 Agents, each with distinct tool access and isolation boundaries

#### Agent 1: Ingest Agent

**Purpose:** YouTube + X/Twitter content ingestion into Obsidian vault
**Model:** GLM-4.7-Flash (local, free) — fast for parsing/formatting
**Container access:**
- READ/WRITE: `swarm-kb/youtube/`, `swarm-kb/x-posts/`, `swarm-kb/_index/`
- Tools: `fetch_transcript`, `batch_fetch_transcripts`, `fetch_tweet`, `fetch_user_timeline`, `search_tweets`
- DENY: exec, git, browser, email

**Scheduled tasks:**
```
Every 6 hours: Fetch new videos from watched YouTube channels
Every 2 hours: Fetch new tweets from watched X accounts
Every 4 hours: Search X for keywords (nanoclaw, bevy, rust gamedev, etc.)
Daily at 6am: Generate daily digest note in swarm-kb/
```

**Watched sources config** (`src/agents/ingest/sources.ts`):
```typescript
export const YOUTUBE_CHANNELS = [
  // Add channels relevant to your project
  { id: "UC...", name: "Channel Name", tags: ["bevy", "rust"] },
];

export const X_ACCOUNTS = [
  { handle: "bevyengine", tags: ["bevy", "gamedev"] },
  { handle: "rustlang", tags: ["rust"] },
  // Add accounts relevant to your project
];

export const X_SEARCH_TERMS = [
  "nanoclaw",
  "bevy 0.15",
  "rust game development",
  "ai agent swarm",
];
```

#### Agent 2: Research Agent

**Purpose:** Web research using Crawl4AI + Camoufox + Apify
**Model:** GLM-4.7-Flash (local) → escalate to Claude Sonnet for synthesis
**Container access:**
- READ: `swarm-kb/` (full vault, read-only)
- WRITE: `swarm-kb/research/`
- Tools: Crawl4AI MCP, Apify MCP, proxy pool, Camoufox
- DENY: exec, git, filesystem (outside vault)

**Key capability:** When asked to research a topic:
1. Check Obsidian vault first (existing knowledge)
2. Search YouTube transcripts for relevant content
3. Search X posts for recent discussions
4. Crawl web sources via Crawl4AI
5. Synthesize into a research note in `swarm-kb/research/`
6. Cross-link with `[[wikilinks]]` to related YouTube/X notes

#### Agent 3: Coder Agent

**Purpose:** Code generation, refactoring, git operations
**Model:** MiniMax M2.5 (cloud) or Qwen3-Coder 30B (local)
**Container access:**
- READ/WRITE: project workspace only (mounted repo)
- READ: `swarm-kb/research/` (for context)
- Tools: exec (workspace only), filesystem, git
- DENY: browser, email, web_search, Crawl4AI

#### Agent 4: Review Agent

**Purpose:** Code review, PR quality, security audit
**Model:** Claude Sonnet 4.6 (frontier — worth the cost for reviews)
**Container access:**
- READ: project workspace, `swarm-kb/` (full vault)
- Tools: git (read-only), filesystem (read-only)
- DENY: exec, browser, email, write

#### Agent 5: Ops Agent

**Purpose:** Build/test execution, scheduling, monitoring
**Model:** Qwen 3 8B (local, fast — just running scripts)
**Container access:**
- READ/WRITE: CI/CD configs only
- Tools: exec (limited to build/test scripts), cron
- DENY: browser, email, web_search, git push

### New file: `src/orchestrator/index.ts`

Orchestrator that:
1. Receives tasks from user (Discord/Telegram/CLI)
2. Routes to appropriate agent based on task type
3. Manages inter-agent communication via Obsidian vault
4. Escalates model tier when local model output fails twice
5. Tracks token spend per agent per task

### New file: `src/orchestrator/router.ts`

Task routing logic:
```
"fetch/ingest/watch/subscribe" → Ingest Agent
"research/find/look up/what is" → Research Agent
"implement/code/fix/refactor"  → Coder Agent
"review/audit/check/security"  → Review Agent
"build/test/deploy/schedule"   → Ops Agent
```

### New file: `src/orchestrator/model-router.ts`

Model selection per task complexity:
```typescript
function selectModel(agent: AgentType, taskComplexity: "low" | "medium" | "high"): ModelConfig {
  const routing = {
    ingest:   { low: "ollama:qwen3:8b",          medium: "ollama:glm-4.7",           high: "ollama:glm-4.7" },
    research: { low: "ollama:glm-4.7",            medium: "ollama:glm-4.7",           high: "anthropic:claude-sonnet-4-6" },
    coder:    { low: "ollama:qwen3-coder:30b",    medium: "ollama:minimax-m2.5:cloud", high: "anthropic:claude-sonnet-4-6" },
    review:   { low: "ollama:qwen3-coder:30b",    medium: "anthropic:claude-sonnet-4-6", high: "anthropic:claude-opus-4-6" },
    ops:      { low: "ollama:qwen3:8b",           medium: "ollama:qwen3:8b",           high: "ollama:glm-4.7" },
  };
  return routing[agent][taskComplexity];
}
```

---

## Phase 6: Context Optimization (Days 6-8)

### Problem

Every token in an agent's context window costs money (API) or latency (local). The PRD targets:
- System prompt: <2,000 tokens
- Memory recall: <1,500 tokens
- Tool results: <4,000 tokens

### Strategy 1: Obsidian as Context Cache

Instead of stuffing full transcripts into context, store in Obsidian and retrieve only relevant excerpts:

```
Agent needs info about "Bevy rapier2d"
  → Search swarm-kb/ for tag:bevy + tag:rapier2d
  → Return only matching paragraphs (not full transcripts)
  → Include [[wikilinks]] so agent can fetch more if needed
```

### New file: `src/context/truncator.ts`

Enforce token budgets on all tool outputs:
```typescript
function truncateToTokenBudget(text: string, maxTokens: number): string {
  // Approximate: 1 token ≈ 4 chars for English
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[... truncated — use get_transcript for full content]";
}
```

Apply to:
- `fetch_transcript` → truncate fullText to 3,000 tokens, store full in Obsidian
- `search_knowledge_base` → return max 5 results, 3 matched lines each
- `fetch_tweet` → truncate thread to 2,000 tokens
- Crawl4AI output → truncate to 4,000 tokens

### Strategy 2: Tiered Retrieval

```
Level 1: Metadata only (title, tags, channel, date) — ~50 tokens/entry
Level 2: Metadata + summary (first 200 words) — ~300 tokens/entry
Level 3: Full content — variable, budget-capped
```

Agent starts at Level 1 (cheap scan), drills into Level 2/3 only for relevant items.

### New file: `src/context/summarizer.ts`

Auto-generate summaries for all ingested content:
- YouTube: First 200 words + key topics extracted
- X threads: Thread thesis + key claims
- Research: Executive summary + findings list

Summaries stored in frontmatter `summary:` field. Agents search summaries first,
fetch full content only when needed.

### Strategy 3: Agent Memory Compaction

Each agent's memory file (`swarm-kb/agents/{agent}.md`) is kept under 200 lines:
```typescript
async function compactAgentMemory(agentName: string): Promise<void> {
  const memoryPath = `swarm-kb/agents/${agentName}.md`;
  const content = await readFile(memoryPath, "utf-8");
  const lines = content.split("\n");
  if (lines.length > 200) {
    // Keep last 150 lines (recent), summarize older into "## Archive" section
    // Use local model (qwen3:8b) to summarize old entries
  }
}
```

### Strategy 4: Deduplicated Cross-References

When an agent needs context from multiple sources, use Obsidian wikilinks
instead of duplicating content:

```markdown
## Context for this task
- Bevy rapier2d approaches: [[youtube/abc123#rapier-section]]
- Recent discussion: [[x-posts/456789]]
- Prior implementation: [[research/bevy-physics-2026-03-05]]
```

This gives the agent pointers (~100 tokens) instead of full content (~5,000 tokens).
The agent fetches specific sections only when needed.

---

## Phase 7: MCP Server Expansion (Days 7-9)

### Updated MCP tools (add to existing `src/mcp/server.ts`):

**YouTube (existing, enhanced):**
- `fetch_transcript` — existing, add truncation + Obsidian storage
- `batch_fetch_transcripts` — existing, add Obsidian storage
- `search_knowledge_base` — existing, point to Obsidian vault
- `list_knowledge_base` — existing, point to Obsidian indexes
- `get_transcript` — existing, read from Obsidian vault

**X/Twitter (new):**
- `fetch_tweet` — Fetch tweet/thread, store in Obsidian
- `fetch_user_timeline` — Recent tweets from a user
- `search_tweets` — Search X by keyword

**Research (new):**
- `web_scrape` — Crawl4AI single-page fetch → markdown
- `web_crawl` — Crawl4AI multi-page BFS
- `research_topic` — Orchestrated: check vault → search web → synthesize

**Knowledge Base (new):**
- `kb_search` — Compound query across all content types
- `kb_recent` — Last N entries across all types
- `kb_by_tag` — All entries with a specific tag
- `kb_related` — Find entries related to a given entry (via tags + wikilinks)

**Context (new):**
- `get_summary` — Get truncated summary of any KB entry
- `get_section` — Get specific section of a document by heading

---

## Phase 8: Docker Compose for Full Stack (Days 8-10)

### New file: `docker-compose.yml`

```yaml
services:
  # YouTube + X transcript API
  swarm-api:
    build: .
    ports: ["3100:3100"]
    volumes:
      - /Users/u/Documents/swarm-kb:/app/swarm-kb
    environment:
      - OBSIDIAN_VAULT=/app/swarm-kb
      - APIFY_API_TOKEN=${APIFY_API_TOKEN}
      - PROXY_HOST=${PROXY_HOST}
      - PROXY_PORT=${PROXY_PORT}
      - PROXY_USER=${PROXY_USER}
      - PROXY_PASS=${PROXY_PASS}

  # Crawl4AI scraping engine
  crawl4ai:
    image: unclecode/crawl4ai:latest
    ports: ["11235:11235"]

  # Camoufox anti-detect browser (REST API)
  camofox:
    image: jo-inc/camofox-browser
    ports: ["9377:9377"]
    environment:
      - PROXY_HOST=${PROXY_HOST}
      - PROXY_PORT=${PROXY_PORT}
      - PROXY_USERNAME=${PROXY_USER}
      - PROXY_PASSWORD=${PROXY_PASS}
```

---

## Complete Command Reference

### Setup Commands (run once)

```bash
# 1. Init project
cd /Users/u/swarm
git init && git add -A && git commit -m "Initial commit"

# 2. Create Obsidian vault
mkdir -p /Users/u/Documents/swarm-kb/{youtube,x-posts,research,agents,_index,_templates}

# 3. Clone NanoClaw
cd ~ && git clone https://github.com/qwibitai/nanoclaw.git

# 4. Pull Ollama models
ollama pull qwen3-coder:30b
ollama pull glm-4.7
ollama pull qwen3:8b
ollama pull minimax-m2.5:cloud

# 5. Deploy scraping stack
docker pull unclecode/crawl4ai:latest
docker run -d --name crawl4ai -p 11235:11235 unclecode/crawl4ai:latest
pip install camoufox && python -m camoufox fetch

# 6. Register MCP servers
claude mcp add --transport sse crawl4ai http://localhost:11235/mcp/sse

# 7. Install project dependencies
cd /Users/u/swarm && npm install

# 8. Copy and configure .env
cp .env.example .env
# Edit .env with your API keys and proxy credentials
```

### Daily Operation Commands

```bash
# Start Ollama
ollama serve

# Start scraping stack
docker compose up -d

# Start swarm API (dev mode)
npm run dev

# Start MCP server (for Claude Code/Desktop)
npm run mcp

# Check running models
ollama ps

# Check container status
docker ps

# Test YouTube transcript fetch
curl -X POST http://localhost:3100/api/transcript \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=VIDEO_ID"}'

# Test X/Twitter fetch (after Phase 3)
curl -X POST http://localhost:3100/api/x/tweet \
  -H "Content-Type: application/json" \
  -d '{"url": "https://x.com/user/status/TWEET_ID"}'

# Search knowledge base
curl "http://localhost:3100/api/kb/search?q=bevy+rapier"

# Test Crawl4AI
curl http://localhost:11235/mcp/schema

# Test Ollama local model
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3:8b","messages":[{"role":"user","content":"hello"}]}'
```

### NanoClaw Swarm Commands (after NanoClaw setup)

```
# From Discord/Telegram/CLI:
@Swarm ingest latest videos from @3Blue1Brown
@Swarm research Bevy rapier2d collision physics
@Swarm implement card magnet system based on research
@Swarm review the card physics PR
@Swarm run tests and report

# Scheduled (configured in NanoClaw):
@Ingest fetch new videos from watched channels    (every 6h)
@Ingest fetch new tweets from watched accounts     (every 2h)
@Ingest search X for "bevy" "rust gamedev"         (every 4h)
@Ingest generate daily digest                      (daily 6am)
@Ops run cargo test and report failures            (nightly 2am)
@Research compile AI agent news from HN + X        (Monday 8am)
```

---

## New Files to Create (ordered by dependency)

```
src/
├── obsidian/
│   ├── vault.ts              ← Obsidian vault read/write operations
│   ├── index-manager.ts      ← JSON index manager (replaces KB index)
│   ├── query.ts              ← Compound search across vault
│   └── moc.ts                ← Auto-generate Map of Content
├── x-twitter/
│   ├── fetcher.ts            ← X content fetcher (Nitter → Crawl4AI → Apify)
│   ├── nitter.ts             ← Nitter instance pool + RSS parsing
│   ├── thread-resolver.ts    ← Full thread resolution
│   └── parser.ts             ← X content cleaning + markdown conversion
├── scraping/
│   ├── router.ts             ← 5-layer scraping decision router
│   ├── crawl4ai-client.ts    ← Crawl4AI TypeScript client
│   ├── camoufox-client.ts    ← Camoufox Python subprocess wrapper
│   └── proxy-pool.ts         ← Multi-provider proxy rotation
├── context/
│   ├── truncator.ts          ← Token budget enforcement
│   └── summarizer.ts         ← Auto-summary generation
├── orchestrator/
│   ├── index.ts              ← Swarm orchestrator
│   ├── router.ts             ← Task → agent routing
│   └── model-router.ts       ← Task complexity → model selection
└── agents/
    ├── ingest/
    │   ├── config.ts          ← Watched channels/accounts/keywords
    │   └── scheduler.ts       ← Scheduled ingestion jobs
    ├── research/
    │   └── config.ts          ← Research agent tools + boundaries
    ├── coder/
    │   └── config.ts          ← Coder agent tools + boundaries
    ├── review/
    │   └── config.ts          ← Review agent tools + boundaries
    └── ops/
        └── config.ts          ← Ops agent tools + boundaries
```

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

## Phase 9: NanoClaw Integration — Local Customizations Only

### Principle: NanoClaw as Upstream Dependency

NanoClaw is a cloned repo at `/Users/u/nanoclaw/`. We treat it as an upstream
dependency — **zero source code modifications**. All swarm-specific logic lives
in `/Users/u/swarm/`. This means NanoClaw can be `git pull`'d without conflicts.

**Allowed NanoClaw changes (config, not code):**
- `src/channels/index.ts` — `import './slack.js'` (plugin activation, the designed pattern)
- `groups/*/CLAUDE.md` — per-agent instructions (config files, not source)
- `swarm-groups.json` — group registration reference (config file)

**Everything else stays in `/Users/u/swarm/`.**

### 9A. 1Password Secrets — Vault Isolation

**Critical:** All secrets live in a dedicated 1Password vault named `Swarm`.
The swarm scripts ONLY access `op://Swarm/*` references — never the personal vault.

#### Vault Structure

```
1Password Vault: "Swarm"
├── anthropic          (Login item)
│   ├── api-key        → ANTHROPIC_API_KEY
│   ├── oauth-token    → CLAUDE_CODE_OAUTH_TOKEN (if using subscription)
│   └── base-url       → ANTHROPIC_BASE_URL
├── slack              (Login item)
│   ├── bot-token      → SLACK_BOT_TOKEN (xoxb-...)
│   └── app-token      → SLACK_APP_TOKEN (xapp-...)
├── apify              (Login item)
│   └── api-token      → APIFY_API_TOKEN
└── proxy              (Login item)
    ├── host           → PROXY_HOST
    ├── port           → PROXY_PORT
    ├── username       → PROXY_USER
    └── password       → PROXY_PASS
```

#### Setup: `scripts/op-setup.sh`

Creates the vault and empty items. Run once:
```bash
cd /Users/u/swarm
./scripts/op-setup.sh
```
Then populate secrets in 1Password UI or via:
```bash
op item edit anthropic --vault Swarm 'api-key=sk-ant-api03-YOUR-KEY'
op item edit slack --vault Swarm 'bot-token=xoxb-YOUR-TOKEN'
op item edit slack --vault Swarm 'app-token=xapp-YOUR-TOKEN'
```

#### Secret Injection: `op inject`

At startup, `op inject` renders a template with 1Password references into
NanoClaw's `.env` file. The template (`config/nanoclaw.env.tpl`) contains
references like `{{ op://Swarm/anthropic/api-key }}` — never actual values.

```bash
op inject -i config/nanoclaw.env.tpl -o /Users/u/nanoclaw/.env
```

NanoClaw's existing `readEnvFile()` reads `.env` normally. No source changes needed.
The `.env` is already in NanoClaw's `.gitignore`.

**Security properties:**
- Secrets never stored in version control
- Secrets never in swarm project files (only `op://` references)
- 1Password biometric auth required at each startup
- Vault access revocable independently of personal credentials
- Container agents receive secrets via stdin (NanoClaw's existing mechanism)

### 9B. NanoClaw Extension Points We Use

NanoClaw provides four external customization mechanisms. We use all four:

#### 1. Per-group `settings.json` → Swarm MCP Server

NanoClaw auto-creates `data/sessions/{folder}/.claude/settings.json` per group.
If the file already exists (`if (!fs.existsSync(settingsFile))`), NanoClaw skips
creation — preserving our version.

We pre-create this file with NanoClaw's defaults PLUS our swarm MCP server:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1",
    "CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD": "1",
    "CLAUDE_CODE_DISABLE_AUTO_MEMORY": "0"
  },
  "mcpServers": {
    "swarm": {
      "command": "npx",
      "args": ["tsx", "/workspace/extra/swarm-project/src/mcp/stdio.ts"],
      "env": {
        "OBSIDIAN_VAULT": "/workspace/extra/swarm-kb",
        "DATA_DIR": "/workspace/group/data",
        "CRAWL4AI_URL": "http://host.docker.internal:11235",
        "CAMOFOX_URL": "http://host.docker.internal:9377",
        "OLLAMA_URL": "http://host.docker.internal:11434"
      }
    }
  },
  "permissions": {
    "allow": ["mcp__swarm__*"]
  }
}
```

Template lives at `config/settings-base.json`. Setup script copies it per group.

#### 2. Per-group `agent-runner-src/` → `allowedTools` Patch

NanoClaw copies `container/agent-runner/src/` to `data/sessions/{folder}/agent-runner-src/`
on first run. This per-group copy is compiled inside the container and used for all
subsequent runs. We pre-seed this copy and apply a targeted patch:

```bash
# Add mcp__swarm__* to the allowedTools whitelist
sed "s/'mcp__nanoclaw__\*'/'mcp__nanoclaw__*',\n        'mcp__swarm__*'/" \
  "$target/index.ts" > "$target/index.ts.tmp" && mv "$target/index.ts.tmp" "$target/index.ts"
```

This is the only way to whitelist swarm tools — the SDK's `allowedTools` in `query()`
filters which tools the model can use, regardless of `permissionMode`.

#### 3. Mount Allowlist → `~/.config/nanoclaw/mount-allowlist.json`

External config (outside NanoClaw repo) that controls which host directories
containers can access. We install this at startup:

```json
{
  "allowedRoots": [
    {"path": "/Users/u/Documents/swarm-kb", "allowReadWrite": true,
     "description": "Obsidian knowledge base"},
    {"path": "/Users/u/swarm", "allowReadWrite": true,
     "description": "Swarm API project"}
  ],
  "blockedPatterns": [
    ".ssh", ".gnupg", ".aws", ".docker", "credentials",
    ".env", "*.pem", "*.key", "node_modules"
  ]
}
```

#### 4. CLAUDE.md Per Group → Agent Instructions

Already in place at `nanoclaw/groups/slack_swarm-*/CLAUDE.md`. These are config
files that define each agent's role, tools, and constraints. They're mounted
read-write into containers at `/workspace/group/CLAUDE.md`.

### 9C. Secrets Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│                 1Password Vault: "Swarm"              │
│  anthropic/api-key, slack/bot-token, slack/app-token  │
└────────────────────┬────────────────────────────────┘
                     │ op inject (biometric auth)
                     ▼
┌──────────────────────────────────────────────────────┐
│  /Users/u/nanoclaw/.env  (gitignored, ephemeral)      │
│  ANTHROPIC_API_KEY=sk-ant-...                         │
│  SLACK_BOT_TOKEN=xoxb-...                             │
│  SLACK_APP_TOKEN=xapp-...                             │
└────────────────────┬────────────────────────────────┘
                     │ readEnvFile() at startup
                     ▼
┌──────────────────────────────────────────────────────┐
│  NanoClaw Process (host)                              │
│  readSecrets() → {ANTHROPIC_API_KEY: "sk-ant-..."}    │
└────────────────────┬────────────────────────────────┘
                     │ stdin JSON (never written to disk)
                     ▼
┌──────────────────────────────────────────────────────┐
│  Container: nanoclaw-slack_swarm-main-*                │
│  agent-runner reads stdin → sdkEnv[key] = value       │
│  Claude Code SDK uses key for API calls               │
│  Key never in env vars, never on container filesystem  │
└──────────────────────────────────────────────────────┘
```

### 9D. PoC Startup Script

Single entry point: `scripts/start.sh`

```
1. Verify prerequisites (op, docker, node, nanoclaw dir)
2. op inject → generate NanoClaw .env from 1Password
3. Install mount allowlist to ~/.config/nanoclaw/
4. For each swarm group:
   a. Pre-seed agent-runner-src/ (copy + patch allowedTools)
   b. Pre-create settings.json with swarm MCP config
5. docker compose up -d (crawl4ai service)
6. cd /Users/u/nanoclaw && npm start
```

### 9E. File Layout in Swarm Project

```
/Users/u/swarm/
  scripts/
    start.sh              ← PoC startup orchestrator
    setup-groups.sh       ← Pre-seeds agent-runner + settings per group
    op-setup.sh           ← One-time 1Password vault creation
  config/
    nanoclaw.env.tpl      ← 1Password reference template for op inject
    settings-base.json    ← Base settings.json with swarm MCP config
    mount-allowlist.json  ← NanoClaw mount security config
```

### 9F. Handling NanoClaw Updates

When pulling upstream NanoClaw changes:

1. `cd /Users/u/nanoclaw && git pull` — should merge cleanly (only channels/index.ts
   and groups/ CLAUDE.md are changed, both are config-level)
2. If `container/agent-runner/src/index.ts` changes upstream, delete the per-group
   copies and re-run setup: `rm -rf data/sessions/*/agent-runner-src/ && cd /Users/u/swarm && ./scripts/setup-groups.sh`
3. If `settings.json` defaults change, update `config/settings-base.json` to include
   new fields and re-run setup

---

## Implementation Priority

1. **NanoClaw integration** — scripts, configs, 1Password (Phase 9)
2. **Obsidian vault integration** — everything else depends on shared KB
3. **X/Twitter pipeline** — user's top priority for fresh content
4. **Context optimization** — reduces cost of everything that follows
5. **Scraping stack** — Crawl4AI + Camoufox for research agent
6. **Agent definitions** — NanoClaw container configs
7. **Orchestrator** — ties agents together
8. **Scheduling** — automated ingestion loops
