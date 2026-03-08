/**
 * Ingestion cycle runners — called by the scheduler or manually via REST API.
 * Pure orchestration: loads sources, calls ingest functions, returns results.
 */

import { loadSources } from "./sources.js";
import { ingestUserTimeline, ingestSearchTweets } from "./x-twitter.js";

export interface IngestionResult {
  source: string;
  type: "youtube" | "x-timeline" | "x-search" | "rss" | "github" | "substack";
  itemsIngested: number;
  errors: string[];
}

/**
 * Run a full ingestion cycle for all X/Twitter sources.
 */
export async function runXIngestionCycle(): Promise<IngestionResult[]> {
  const sources = loadSources();
  const results: IngestionResult[] = [];

  for (const account of sources.xAccounts) {
    try {
      const tweets = await ingestUserTimeline(account.handle, 10);
      results.push({
        source: `@${account.handle}`,
        type: "x-timeline",
        itemsIngested: tweets.length,
        errors: [],
      });
    } catch (err) {
      results.push({
        source: `@${account.handle}`,
        type: "x-timeline",
        itemsIngested: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  for (const term of sources.xSearchTerms) {
    try {
      const tweets = await ingestSearchTweets(term.query, 10);
      results.push({
        source: `search:"${term.query}"`,
        type: "x-search",
        itemsIngested: tweets.length,
        errors: [],
      });
    } catch (err) {
      results.push({
        source: `search:"${term.query}"`,
        type: "x-search",
        itemsIngested: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  return results;
}
