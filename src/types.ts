import { z } from "zod";

// Raw segment from youtube-transcript-plus
export const TranscriptSegmentSchema = z.object({
  text: z.string(),
  offset: z.number(),
  duration: z.number(),
  lang: z.string(),
});

export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

// Processed transcript
export const TranscriptSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  channelName: z.string().optional(),
  url: z.string().url(),
  language: z.string(),
  fetchedAt: z.string().datetime(),
  durationSeconds: z.number(),
  segments: z.array(TranscriptSegmentSchema),
  fullText: z.string(),
  wordCount: z.number(),
});

export type Transcript = z.infer<typeof TranscriptSchema>;

// Single transcript request
export const TranscriptRequestSchema = z.object({
  url: z.string(),
  language: z.string().default("en"),
  store: z.boolean().default(true),
});

export type TranscriptRequest = z.infer<typeof TranscriptRequestSchema>;

// Batch request
export const BatchRequestSchema = z.object({
  urls: z.array(z.string()).min(1).max(50),
  language: z.string().default("en"),
  concurrency: z.number().min(1).max(10).default(3),
  store: z.boolean().default(true),
});

export type BatchRequest = z.infer<typeof BatchRequestSchema>;

// Batch result per URL
export const BatchResultSchema = z.object({
  url: z.string(),
  videoId: z.string(),
  status: z.enum(["success", "error"]),
  transcript: TranscriptSchema.optional(),
  error: z.string().optional(),
});

export type BatchResult = z.infer<typeof BatchResultSchema>;

// Knowledge base entry (stored in index.json)
export const KBEntrySchema = z.object({
  videoId: z.string(),
  title: z.string(),
  channelName: z.string().optional(),
  url: z.string(),
  language: z.string(),
  fetchedAt: z.string().datetime(),
  durationSeconds: z.number(),
  wordCount: z.number(),
  filePath: z.string(),
  tags: z.array(z.string()).default([]),
});

export type KBEntry = z.infer<typeof KBEntrySchema>;

// Knowledge base index file
export const KBIndexSchema = z.object({
  version: z.number(),
  lastUpdated: z.string(),
  entries: z.record(z.string(), KBEntrySchema),
});

export type KBIndex = z.infer<typeof KBIndexSchema>;

// Search result
export interface SearchResult {
  entry: KBEntry;
  matchedLines: string[];
}

// API error response
export interface ApiError {
  error: string;
  message: string;
  videoId?: string;
  availableLanguages?: string[];
}
