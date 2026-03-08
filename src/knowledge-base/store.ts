import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import { config } from "../config.js";
import { upsertEntry, removeEntry } from "./index-manager.js";
import type { Transcript, KBEntry } from "../types.js";

const TRANSCRIPTS_DIR = join(config.dataDir, "transcripts");

function transcriptPath(videoId: string): string {
  return join(TRANSCRIPTS_DIR, `${videoId}.md`);
}

/**
 * Store a transcript as a markdown file with YAML frontmatter and update the index.
 */
export async function storeTranscript(transcript: Transcript): Promise<KBEntry> {
  const filePath = `${transcript.videoId}.md`;
  const entry: KBEntry = {
    videoId: transcript.videoId,
    title: transcript.title,
    channelName: transcript.channelName,
    url: transcript.url,
    language: transcript.language,
    fetchedAt: transcript.fetchedAt,
    durationSeconds: transcript.durationSeconds,
    wordCount: transcript.wordCount,
    filePath,
    tags: [],
  };

  const frontmatter = yamlStringify({
    videoId: entry.videoId,
    title: entry.title,
    channelName: entry.channelName,
    url: entry.url,
    language: entry.language,
    fetchedAt: entry.fetchedAt,
    durationSeconds: entry.durationSeconds,
    wordCount: entry.wordCount,
    tags: entry.tags,
  });

  const markdown = `---\n${frontmatter}---\n\n# ${transcript.title || transcript.videoId}\n\n${transcript.fullText}\n`;

  await writeFile(transcriptPath(transcript.videoId), markdown, "utf-8");
  await upsertEntry(entry);

  return entry;
}

/**
 * Read a stored transcript's full markdown content.
 */
export async function readTranscript(videoId: string): Promise<string | null> {
  try {
    return await readFile(transcriptPath(videoId), "utf-8");
  } catch {
    return null;
  }
}

/**
 * Delete a transcript file and remove from index.
 */
export async function deleteTranscript(videoId: string): Promise<boolean> {
  try {
    await unlink(transcriptPath(videoId));
  } catch {
    // File may already be gone
  }
  return removeEntry(videoId);
}
