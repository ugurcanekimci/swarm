import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.js";
import type { KBIndex, KBEntry } from "../types.js";

const INDEX_PATH = join(config.dataDir, "transcripts", "index.json");

let memoryIndex: KBIndex | null = null;

export async function loadIndex(): Promise<KBIndex> {
  if (memoryIndex) return memoryIndex;
  try {
    const raw = await readFile(INDEX_PATH, "utf-8");
    memoryIndex = JSON.parse(raw) as KBIndex;
  } catch {
    memoryIndex = { version: 1, lastUpdated: "", entries: {} };
  }
  return memoryIndex;
}

async function persistIndex(index: KBIndex): Promise<void> {
  index.lastUpdated = new Date().toISOString();
  const tmp = INDEX_PATH + ".tmp";
  await writeFile(tmp, JSON.stringify(index, null, 2), "utf-8");
  await rename(tmp, INDEX_PATH);
  memoryIndex = index;
}

export async function upsertEntry(entry: KBEntry): Promise<void> {
  const index = await loadIndex();
  index.entries[entry.videoId] = entry;
  await persistIndex(index);
}

export async function removeEntry(videoId: string): Promise<boolean> {
  const index = await loadIndex();
  if (!(videoId in index.entries)) return false;
  delete index.entries[videoId];
  await persistIndex(index);
  return true;
}

export async function getEntry(videoId: string): Promise<KBEntry | undefined> {
  const index = await loadIndex();
  return index.entries[videoId];
}

export async function listEntries(): Promise<KBEntry[]> {
  const index = await loadIndex();
  return Object.values(index.entries);
}
