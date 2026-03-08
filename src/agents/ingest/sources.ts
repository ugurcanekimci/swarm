/**
 * Watched sources configuration for the Ingest Agent.
 * Add YouTube channels, X accounts, and search keywords here.
 */

export interface YouTubeSource {
  channelId: string;
  name: string;
  tags: string[];
}

export interface XSource {
  handle: string;
  tags: string[];
}

/**
 * YouTube channels to monitor for new videos.
 * Edit this list to add/remove channels.
 */
export const YOUTUBE_CHANNELS: YouTubeSource[] = [
  // Add your watched channels here:
  // { channelId: "UCxxxxxxxx", name: "Channel Name", tags: ["topic"] },
];

/**
 * X/Twitter accounts to monitor for new tweets.
 */
export const X_ACCOUNTS: XSource[] = [
  // Add your watched accounts here:
  // { handle: "username", tags: ["topic"] },
];

/**
 * Keywords to search on X periodically.
 */
export const X_SEARCH_TERMS: string[] = [
  // Add search terms here:
  // "nanoclaw",
  // "bevy engine",
];

/**
 * Ingestion schedule (cron-style descriptions).
 * These are implemented via NanoClaw scheduled tasks.
 */
export const SCHEDULES = {
  youtubeChannelCheck: "every 6 hours",
  xAccountCheck: "every 2 hours",
  xKeywordSearch: "every 4 hours",
  dailyDigest: "daily at 6am",
} as const;
