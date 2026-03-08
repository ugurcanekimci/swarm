/**
 * YouTube ingestion — fetch transcript and store in Obsidian vault.
 */

import { getTranscript } from "../core/transcript.js";
import { writeYouTubeTranscript } from "../obsidian/vault.js";
import { upsertEntry, type IndexEntry } from "../obsidian/index-manager.js";
import { frontmatterSummary, extractTopics } from "../context/summarizer.js";
import { generateMOC } from "../obsidian/moc.js";

/**
 * Fetch a YouTube video transcript and store it in the Obsidian vault.
 * Returns the index entry for the stored transcript.
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
