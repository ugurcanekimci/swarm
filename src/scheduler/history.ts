/**
 * Ingestion history — JSONL log of scheduler runs.
 */

import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export interface HistoryEntry {
  timestamp: string;
  jobName: string;
  source: string;
  type: string;
  itemsIngested: number;
  errors: string[];
  durationMs: number;
}

const historyPath = path.join(config.dataDir, "ingest-history.jsonl");

export function appendHistory(entry: HistoryEntry): void {
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.appendFileSync(historyPath, JSON.stringify(entry) + "\n");
}

export function readHistory(limit = 50): HistoryEntry[] {
  if (!fs.existsSync(historyPath)) return [];

  const lines = fs.readFileSync(historyPath, "utf-8").trim().split("\n").filter(Boolean);
  const entries: HistoryEntry[] = [];

  // Read from end for most recent
  const start = Math.max(0, lines.length - limit);
  for (let i = lines.length - 1; i >= start; i--) {
    try {
      entries.push(JSON.parse(lines[i]!));
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}
