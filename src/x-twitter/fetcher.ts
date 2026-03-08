/**
 * X/Twitter content fetcher with fallback cascade:
 *   Nitter RSS (free) → Crawl4AI+Camoufox (proxy cost) → Apify (credits)
 */

import { config } from "../config.js";
import { extractTweetId, extractTweetMeta, formatThread, cleanTweetText } from "./parser.js";
import { fetchTweetPage, fetchUserTimeline, searchNitter } from "./nitter.js";
import { writeXPost } from "../obsidian/vault.js";
import { upsertEntry, type IndexEntry } from "../obsidian/index-manager.js";
import { frontmatterSummary, extractTopics } from "../context/summarizer.js";
import { generateMOC } from "../obsidian/moc.js";

export interface FetchedTweet {
  tweetId: string;
  author: string;
  authorName: string;
  url: string;
  content: string;
  isThread: boolean;
  tweetCount: number;
  fetchedAt: string;
  tags: string[];
}

/**
 * Fetch a single tweet or thread by URL.
 * Cascade: Nitter → Crawl4AI → Apify
 */
export async function fetchTweet(urlOrId: string): Promise<FetchedTweet> {
  const tweetId = extractTweetId(urlOrId);
  const url = `https://x.com/i/status/${tweetId}`;

  // Try Nitter first — extract username from URL if available
  const usernameMatch = urlOrId.match(/(?:twitter\.com|x\.com)\/(\w+)\/status/);
  const username = usernameMatch?.[1] || "i";

  let rawContent: string | null = null;

  // Layer 1: Nitter
  const nitterHtml = await fetchTweetPage(username, tweetId);
  if (nitterHtml) {
    rawContent = extractTextFromNitterHtml(nitterHtml);
  }

  // Layer 2: Crawl4AI (if configured)
  if (!rawContent && config.crawl4aiUrl) {
    rawContent = await fetchViaCrawl4AI(url);
  }

  // Layer 3: Apify fallback
  if (!rawContent && config.apifyToken) {
    rawContent = await fetchViaApify(tweetId);
  }

  if (!rawContent) {
    throw new Error(`Failed to fetch tweet ${tweetId} — all sources exhausted`);
  }

  const cleaned = cleanTweetText(rawContent);
  const meta = extractTweetMeta(rawContent);
  const topics = extractTopics(cleaned);
  const tags = [...new Set([...meta.hashtags, ...topics.slice(0, 5)])];

  const result: FetchedTweet = {
    tweetId,
    author: username !== "i" ? username : meta.mentions[0] || "unknown",
    authorName: username !== "i" ? username : meta.mentions[0] || "unknown",
    url: `https://x.com/${username}/status/${tweetId}`,
    content: cleaned,
    isThread: cleaned.includes("---"), // Simple thread detection
    tweetCount: (cleaned.match(/\*\*\d+\/\d+:\*\*/g) || []).length || 1,
    fetchedAt: new Date().toISOString(),
    tags,
  };

  return result;
}

/**
 * Fetch and store a tweet in the Obsidian vault.
 */
export async function fetchAndStoreTweet(urlOrId: string): Promise<FetchedTweet> {
  const tweet = await fetchTweet(urlOrId);

  // Write to Obsidian vault
  await writeXPost({
    tweetId: tweet.tweetId,
    author: tweet.author,
    authorName: tweet.authorName,
    url: tweet.url,
    isThread: tweet.isThread,
    tweetCount: tweet.tweetCount,
    content: tweet.content,
    summary: frontmatterSummary(tweet.content),
    tags: tweet.tags,
  });

  // Update index
  const entry: IndexEntry = {
    id: tweet.tweetId,
    type: "x-post",
    title: tweet.content.slice(0, 100) + (tweet.content.length > 100 ? "..." : ""),
    url: tweet.url,
    summary: frontmatterSummary(tweet.content),
    tags: tweet.tags,
    fetchedAt: tweet.fetchedAt,
    filePath: `${tweet.tweetId}.md`,
    author: tweet.author,
    tweetCount: tweet.tweetCount,
  };
  await upsertEntry(entry);

  // Regenerate MOC
  await generateMOC();

  return tweet;
}

/**
 * Fetch recent tweets from a user and store them.
 */
export async function fetchAndStoreUserTimeline(
  username: string,
  limit = 20,
): Promise<FetchedTweet[]> {
  const nitterTweets = await fetchUserTimeline(username, limit);
  const results: FetchedTweet[] = [];

  for (const tweet of nitterTweets) {
    const cleaned = cleanTweetText(tweet.text);
    const meta = extractTweetMeta(tweet.text);
    const topics = extractTopics(cleaned);

    const fetched: FetchedTweet = {
      tweetId: tweet.id,
      author: tweet.author,
      authorName: tweet.authorName,
      url: tweet.url,
      content: cleaned,
      isThread: false,
      tweetCount: 1,
      fetchedAt: new Date().toISOString(),
      tags: [...new Set([...meta.hashtags, ...topics.slice(0, 5)])],
    };

    await writeXPost({
      tweetId: fetched.tweetId,
      author: fetched.author,
      authorName: fetched.authorName,
      url: fetched.url,
      isThread: false,
      tweetCount: 1,
      content: fetched.content,
      summary: frontmatterSummary(fetched.content),
      tags: fetched.tags,
    });

    const entry: IndexEntry = {
      id: fetched.tweetId,
      type: "x-post",
      title: fetched.content.slice(0, 100) + (fetched.content.length > 100 ? "..." : ""),
      url: fetched.url,
      summary: frontmatterSummary(fetched.content),
      tags: fetched.tags,
      fetchedAt: fetched.fetchedAt,
      filePath: `${fetched.tweetId}.md`,
      author: fetched.author,
      tweetCount: 1,
    };
    await upsertEntry(entry);

    results.push(fetched);
  }

  if (results.length > 0) {
    await generateMOC();
  }

  return results;
}

/**
 * Search X and store results.
 */
export async function searchAndStoreTweets(
  query: string,
  limit = 20,
): Promise<FetchedTweet[]> {
  const nitterResults = await searchNitter(query, limit);
  const results: FetchedTweet[] = [];

  for (const tweet of nitterResults) {
    const cleaned = cleanTweetText(tweet.text);
    const meta = extractTweetMeta(tweet.text);

    const fetched: FetchedTweet = {
      tweetId: tweet.id,
      author: tweet.author,
      authorName: tweet.authorName,
      url: tweet.url,
      content: cleaned,
      isThread: false,
      tweetCount: 1,
      fetchedAt: new Date().toISOString(),
      tags: [...new Set([...meta.hashtags, ...extractTopics(cleaned).slice(0, 5)])],
    };

    await writeXPost({
      tweetId: fetched.tweetId,
      author: fetched.author,
      authorName: fetched.authorName,
      url: fetched.url,
      isThread: false,
      tweetCount: 1,
      content: fetched.content,
      summary: frontmatterSummary(fetched.content),
      tags: fetched.tags,
    });

    const entry: IndexEntry = {
      id: fetched.tweetId,
      type: "x-post",
      title: fetched.content.slice(0, 100) + (fetched.content.length > 100 ? "..." : ""),
      url: fetched.url,
      summary: frontmatterSummary(fetched.content),
      tags: fetched.tags,
      fetchedAt: fetched.fetchedAt,
      filePath: `${fetched.tweetId}.md`,
      author: fetched.author,
      tweetCount: 1,
    };
    await upsertEntry(entry);

    results.push(fetched);
  }

  if (results.length > 0) {
    await generateMOC();
  }

  return results;
}

// --- Internal helpers ---

function extractTextFromNitterHtml(html: string): string | null {
  // Nitter renders tweet content in .tweet-content divs
  const contentRe = /<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  const matches: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = contentRe.exec(html)) !== null) {
    const text = m[1]!
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<a[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    if (text) matches.push(text);
  }

  return matches.length > 0 ? formatThread(matches) : null;
}

async function fetchViaCrawl4AI(url: string): Promise<string | null> {
  try {
    const response = await fetch(`${config.crawl4aiUrl}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, output_format: "markdown" }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { markdown?: string };
    return data.markdown || null;
  } catch {
    return null;
  }
}

async function fetchViaApify(tweetId: string): Promise<string | null> {
  if (!config.apifyToken) return null;

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/apify~twitter-scraper/run-sync-get-dataset-items?token=${config.apifyToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tweetIDs: [tweetId],
          maxItems: 1,
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{ full_text?: string; text?: string }>;
    if (results.length === 0) return null;
    return results[0]!.full_text || results[0]!.text || null;
  } catch {
    return null;
  }
}
