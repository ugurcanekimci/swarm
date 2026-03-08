import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.js";
import { listEntries } from "./index-manager.js";
import type { KBEntry, SearchResult } from "../types.js";

const TRANSCRIPTS_DIR = join(config.dataDir, "transcripts");

/**
 * Search stored transcripts by keyword.
 * Checks metadata (title, channel) first, then greps file content.
 */
export async function searchTranscripts(query: string): Promise<SearchResult[]> {
  const entries = await listEntries();
  const lower = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const entry of entries) {
    const metadataMatch =
      entry.title.toLowerCase().includes(lower) ||
      (entry.channelName?.toLowerCase().includes(lower) ?? false) ||
      entry.tags.some((t) => t.toLowerCase().includes(lower));

    let matchedLines: string[] = [];

    if (metadataMatch) {
      matchedLines.push(`[metadata match: "${query}"]`);
    }

    try {
      const content = await readFile(
        join(TRANSCRIPTS_DIR, entry.filePath),
        "utf-8",
      );
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.toLowerCase().includes(lower)) {
          matchedLines.push(line.trim());
        }
      }
    } catch {
      // File missing — skip
    }

    if (matchedLines.length > 0) {
      results.push({ entry, matchedLines: matchedLines.slice(0, 10) });
    }
  }

  return results;
}
