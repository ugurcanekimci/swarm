/**
 * Ingestion scheduler — runs periodic fetches from watched sources.
 * Designed to be called by NanoClaw's cron system or a simple setInterval loop.
 */

import { YOUTUBE_CHANNELS, X_ACCOUNTS, X_SEARCH_TERMS } from "./sources.js";
import { getTranscript } from "../../core/transcript.js";
import { writeYouTubeTranscript } from "../../obsidian/vault.js";
import { upsertEntry, type IndexEntry } from "../../obsidian/index-manager.js";
import { fetchAndStoreUserTimeline, searchAndStoreTweets } from "../../x-twitter/fetcher.js";
import { frontmatterSummary, extractTopics } from "../../context/summarizer.js";
import { generateMOC } from "../../obsidian/moc.js";

export interface IngestionResult {
  source: string;
  type: "youtube" | "x-timeline" | "x-search";
  itemsIngested: number;
  errors: string[];
}

/**
 * Run a full ingestion cycle for all X/Twitter sources.
 */
export async function runXIngestionCycle(): Promise<IngestionResult[]> {
  const results: IngestionResult[] = [];

  // Fetch timelines for watched accounts
  for (const account of X_ACCOUNTS) {
    try {
      const tweets = await fetchAndStoreUserTimeline(account.handle, 10);
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

  // Run keyword searches
  for (const term of X_SEARCH_TERMS) {
    try {
      const tweets = await searchAndStoreTweets(term, 10);
      results.push({
        source: `search:"${term}"`,
        type: "x-search",
        itemsIngested: tweets.length,
        errors: [],
      });
    } catch (err) {
      results.push({
        source: `search:"${term}"`,
        type: "x-search",
        itemsIngested: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  return results;
}

/**
 * Ingest a YouTube video by URL and store in Obsidian vault.
 */
export async function ingestYouTubeVideo(
  urlOrId: string,
  language = "en",
  tags: string[] = [],
): Promise<IndexEntry> {
  const transcript = await getTranscript(urlOrId, language);
  const summary = frontmatterSummary(transcript.fullText);
  const autoTags = extractTopics(transcript.fullText, 5);

  await writeYouTubeTranscript({
    videoId: transcript.videoId,
    title: transcript.title,
    channelName: transcript.channelName,
    url: transcript.url,
    language: transcript.language,
    durationSeconds: transcript.durationSeconds,
    wordCount: transcript.wordCount,
    fullText: transcript.fullText,
    summary,
    tags: [...new Set([...tags, ...autoTags])],
  });

  const entry: IndexEntry = {
    id: transcript.videoId,
    type: "youtube-transcript",
    title: transcript.title,
    url: transcript.url,
    summary,
    tags: [...new Set([...tags, ...autoTags])],
    fetchedAt: new Date().toISOString(),
    filePath: `${transcript.videoId}.md`,
    wordCount: transcript.wordCount,
    channel: transcript.channelName,
    duration: transcript.durationSeconds,
  };
  await upsertEntry(entry);
  await generateMOC();

  return entry;
}
