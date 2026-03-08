import { resolve } from "node:path";

export const config = {
  port: Number(process.env.PORT) || 3100,
  dataDir: resolve(process.env.DATA_DIR || "./data"),
  cacheTTL: Number(process.env.CACHE_TTL) || 86_400_000, // 24h in ms
  batchConcurrency: Number(process.env.BATCH_CONCURRENCY) || 3,
  batchMaxUrls: Number(process.env.BATCH_MAX_URLS) || 50,
  defaultLanguage: process.env.DEFAULT_LANGUAGE || "en",
  apifyToken: process.env.APIFY_API_TOKEN || "",

  // Obsidian vault
  obsidianVault: resolve(process.env.OBSIDIAN_VAULT || "/Users/u/Documents/swarm-kb"),

  // Proxy config
  proxyHost: process.env.PROXY_HOST || "",
  proxyPort: Number(process.env.PROXY_PORT) || 0,
  proxyUser: process.env.PROXY_USER || "",
  proxyPass: process.env.PROXY_PASS || "",

  // Crawl4AI
  crawl4aiUrl: process.env.CRAWL4AI_URL || "http://localhost:11235",

  // Camoufox browser REST API
  camofoxUrl: process.env.CAMOFOX_URL || "http://localhost:9377",

  // Context optimization
  maxToolResultTokens: Number(process.env.MAX_TOOL_RESULT_TOKENS) || 4000,
  maxSearchResults: Number(process.env.MAX_SEARCH_RESULTS) || 10,

  // Ollama
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
} as const;
